import dotenv from "dotenv";
import { qstashService } from "./qstashService.js";
import { notificationService } from "./notificationService.js";
import { generate as openaiGenerate } from "./openaiService.js";
import {
  buildRuleGenerationPrompt,
  buildRuleExecutionPrompt,
} from "../prompts.js";
import {
  Rule,
  getRuleById,
  createRule,
  getUserRules,
  deleteRule,
  updateRuleCronId,
  updateRuleHistory,
} from "../db/rule.js";

// Load environment variables
dotenv.config();

// Re-export Rule type for backwards compatibility
export type { Rule };

class RuleService {
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

      // Verify signature if provided
      if (signature) {
        const ok = await qstashService.verifySignature(rawBody!, signature);
        if (!ok) {
          throw new Error("Invalid QStash signature");
        }
      }

      // Parse payload
      const payload =
        rawBody && rawBody.length
          ? JSON.parse(rawBody.toString("utf8"))
          : body || {};

      const { ruleId } = payload;

      // Get rule
      const { data: rule, error } = await getRuleById(ruleId);
      if (error || !rule) {
        throw new Error(error || "Rule not found");
      }

      // Define schema for structured rule execution response
      const RuleExecutionSchema = {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The result or output of the task execution",
          },
          foundRelevantResults: {
            type: "boolean",
            description:
              "Whether the task yielded important or meaningful results",
          },
        },
        required: ["content", "foundRelevantResults"],
        additionalProperties: false,
      };

      const prompt = buildRuleExecutionPrompt(rule.prompt, rule.history);

      console.log("[rule execution prompt]", prompt);

      // Execute rule with structured output
      const executionResult = await openaiGenerate(prompt, RuleExecutionSchema);

      console.log("[rule execution result]", {
        ruleId,
        response: executionResult,
      });

      // Only store notification if relevant results were found
      if (executionResult.foundRelevantResults) {
        await notificationService.createNotification(rule.user_id, ruleId, {
          result: executionResult.content,
        });

        // Update rule history with the result content
        const currentHistory = rule.history || [];
        const newEntry = {
          content: executionResult.content,
          timestamp: new Date().toISOString(),
        };
        const updatedHistory = [...currentHistory, newEntry];
        await updateRuleHistory(ruleId, updatedHistory);
      }

      return { status: 200, body: { ok: true } };
    } catch (e) {
      console.error("Error handling /rule/execute:", e);
      return {
        status: 500,
        body: {
          error: e instanceof Error ? e.message : "Internal server error",
        },
      };
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
      const { data, error } = await createRule(userId, finalPrompt, ruleId);
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
        await updateRuleCronId(ruleId, scheduleId);
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

  /** Get all rules for a user with frequency enrichment */
  async getAllUserRules(
    user_id: string
  ): Promise<{ data: Rule[] | null; error: any }> {
    try {
      // Get rules from database
      const { data, error } = await getUserRules(user_id);

      if (error) {
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

  /** Delete a rule by ID and its associated QStash schedule */
  async deleteUserRule(
    rule_id: string
  ): Promise<{ success: boolean; error: any }> {
    try {
      // First, fetch the rule to get the cron_id
      const { data: rule, error: fetchError } = await getRuleById(rule_id);
      if (fetchError) {
        console.error("Error fetching rule for deletion:", fetchError);
        return { success: false, error: fetchError };
      }

      // Delete the QStash schedule if it exists
      if (rule?.cron_id) {
        const { success: qstashSuccess, error: qstashError } =
          await qstashService.deleteSchedule(rule.cron_id);
        if (!qstashSuccess) {
          console.warn("Failed to delete QStash schedule:", qstashError);
          // Continue with database deletion even if QStash fails
        }
      }

      // Delete from database
      return await deleteRule(rule_id);
    } catch (error) {
      console.error("Unexpected error deleting rule:", error);
      return { success: false, error };
    }
  }
}

export const ruleService = new RuleService();
