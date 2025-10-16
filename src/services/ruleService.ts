import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { qstashService } from "./qstashService.js";
import { notificationService } from "./notificationService.js";
import { generate as openaiGenerate } from "./openaiService.js";
import {
  buildRuleGenerationPrompt,
  buildRuleExecutionPrompt,
} from "../prompts.js";

// Load environment variables
dotenv.config();

// Define the Rule type for better type safety
export interface Rule {
  id?: string;
  user_id: string;
  prompt: string;
  created_at?: string;
  updated_at?: string;
  cron_id?: string;
}

class RuleService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  /**
   * Handle the /rule/execute behavior: verify signature (if present), parse payload,
   * fetch the rule, and run the OpenAI generation.
   * Returns an object with HTTP status and JSON body for the caller to send.
   */
  async handleExecute(params: {
    rawBody?: Buffer;
    signature?: string;
    body?: any;
  }): Promise<{ status: number; body: any }> {
    try {
      const { rawBody, signature, body } = params;

      if (signature) {
        if (!rawBody) {
          return {
            status: 400,
            body: { error: "Missing raw body for signature verification" },
          };
        }
        const ok = await qstashService.verifySignature(rawBody, signature);
        if (!ok) {
          return { status: 401, body: { error: "Invalid QStash signature" } };
        }
      }

      const payload =
        rawBody && rawBody.length
          ? JSON.parse(rawBody.toString("utf8"))
          : body || {};

      const { ruleId } = payload ?? {};
      if (!ruleId) {
        return { status: 400, body: { error: "Missing ruleId in payload" } };
      }

      const { data: rule, error } = await this.getRuleById(ruleId);
      if (error) {
        console.error("Failed to fetch rule:", error);
        return { status: 500, body: { error: "Failed to fetch rule" } };
      }
      if (!rule) {
        return { status: 404, body: { error: "Rule not found" } };
      }

      try {
        const responseText = await openaiGenerate(rule.prompt);
        console.log("[rule execution result]", {
          ruleId,
          prompt: buildRuleExecutionPrompt(rule.prompt),
          response: responseText,
        });

        // Store notification with top-level rule_id and payload { result: <text> }
        await notificationService.createNotification(rule.user_id, ruleId, {
          result: responseText,
        });
      } catch (err) {
        console.error("OpenAI generation failed:", err);
        return { status: 502, body: { error: "OpenAI generation failed" } };
      }

      return { status: 200, body: { ok: true } };
    } catch (e) {
      console.error("Error handling /rule/execute:", e);
      return { status: 500, body: { error: "Internal server error" } };
    }
  }

  /**
   * Handle the /rule create behavior: validate input, create rule, schedule execution,
   * update cron_id, and return the created rule payload.
   */
  async handleCreate(params: {
    body: any;
  }): Promise<{ status: number; body: any }> {
    try {
      const { body } = params;
      const { userId, textPrompt } = body as {
        userId: string;
        textPrompt: string;
      };

      // Default cadence
      let cadence: "per_minute" | "hourly" | "daily" | "weekly" = "per_minute";

      // Use OpenAI to refine/build the final prompt from the user's idea
      let finalPrompt = textPrompt;
      try {
        const generationInstruction = buildRuleGenerationPrompt(textPrompt);
        const RuleGenSchema = {
          type: "object",
          properties: {
            aiPrompt: { type: "string" },
            frequency: {
              type: "string",
              enum: ["per_minute", "hourly", "daily", "weekly"],
            },
          },
          required: ["aiPrompt", "frequency"],
          additionalProperties: false,
        };
        const structured = await openaiGenerate(
          generationInstruction,
          RuleGenSchema
        );
        if (structured && structured.aiPrompt) {
          finalPrompt = String(structured.aiPrompt).trim();
        }
        if (structured && structured.frequency) {
          cadence = structured.frequency as typeof cadence;
        }
      } catch (err) {
        console.warn(
          "Prompt generation failed, falling back to user textPrompt:",
          err
        );
      }

      const ruleId = crypto.randomUUID();

      // Schedule execution via QStash
      const schedule = await qstashService.scheduleExecution(ruleId, cadence);
      console.log("successfully scheduled execution", schedule);

      // Create rule with the final prompt
      const { data, error } = await this.createRule(
        userId,
        finalPrompt,
        ruleId
      );
      if (error || !data?.id) {
        console.error("Failed to create rule:", error);
        return {
          status: 500,
          body: {
            error: "Failed to create rule",
            details: (error as any)?.message || error,
          },
        };
      }

      const scheduleId = (schedule as any)?.scheduleId ?? (schedule as any)?.id;
      if (scheduleId) {
        await this.updateRuleCronId(ruleId, scheduleId);
      }

      return {
        status: 201,
        body: {
          message: "Rule created successfully",
          rule: {
            ...data,
            cron_id: scheduleId,
            frequency: cadence,
          },
          generatedPrompt: finalPrompt,
        },
      };
    } catch (error) {
      console.error("Unexpected error in handleCreate:", error);
      return { status: 500, body: { error: "Internal server error" } };
    }
  }

  /** Get a single rule by ID */
  async getRuleById(
    rule_id: string | number
  ): Promise<{ data: Rule | null; error: any }> {
    try {
      const { data, error } = await this.supabase
        .from("berry_rules")
        .select("*")
        .eq("id", rule_id as any)
        .single();

      if (error) {
        console.error("Error fetching rule by id:", error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error("Unexpected error fetching rule by id:", error);
      return { data: null, error };
    }
  }

  /** Create a rule */
  async createRule(
    user_id: string,
    prompt: string,
    rule_id?: string
  ): Promise<{ data: Rule | null; error: any }> {
    try {
      const { data, error } = await this.supabase
        .from("berry_rules")
        .insert([
          {
            id: rule_id,
            user_id,
            prompt,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error creating rule:", error);
        return { data: null, error };
      }

      console.log("Rule created successfully:", data);
      return { data, error: null };
    } catch (error) {
      console.error("Unexpected error creating rule:", error);
      return { data: null, error };
    }
  }

  /** Get all rules for a user */
  async getUserRules(
    user_id: string
  ): Promise<{ data: Rule[] | null; error: any }> {
    try {
      console.log("fetching user rules", user_id);
      const { data, error } = await this.supabase
        .from("berry_rules")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      console.log("fetched user rules", data);
      if (error) {
        console.error("Error fetching user rules:", error);
        return { data: null, error };
      }

      // Enrich rules with frequency information from QStash
      if (data) {
        const enrichedData = await Promise.all(
          data.map(async (rule) => {
            if (rule.cron_id) {
              const schedule = await qstashService.getSchedule(rule.cron_id);
              if (schedule?.cron) {
                return {
                  ...rule,
                  frequency: qstashService.cronToFrequency(schedule.cron),
                };
              }
            }
            return { ...rule, frequency: null };
          })
        );
        return { data: enrichedData, error: null };
      }

      return { data, error: null };
    } catch (error) {
      console.error("Unexpected error fetching user rules:", error);
      return { data: null, error };
    }
  }

  /** Delete a rule by ID */
  async deleteRule(rule_id: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await this.supabase
        .from("berry_rules")
        .delete()
        .eq("id", rule_id);

      if (error) {
        console.error("Error deleting rule:", error);
        return { success: false, error };
      }

      console.log("Rule deleted successfully");
      return { success: true, error: null };
    } catch (error) {
      console.error("Unexpected error deleting rule:", error);
      return { success: false, error };
    }
  }

  /** Update a rule's cron_id */
  async updateRuleCronId(rule_id: string, cron_id: string) {
    try {
      const { data, error } = await this.supabase
        .from("berry_rules")
        .update({ cron_id })
        .eq("id", rule_id)
        .select()
        .single();

      if (error) {
        console.error("Error updating rule cron_id:", error);
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      console.error("Unexpected error updating rule cron_id:", error);
      return { data: null, error };
    }
  }
}

export const ruleService = new RuleService();
