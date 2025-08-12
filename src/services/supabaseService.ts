import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Define the Rule type for better type safety
interface Rule {
  id?: string;
  user_id: string;
  prompt: string;
  created_at?: string;
  updated_at?: string;
}

class SupabaseService {
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
   * Get a single rule by ID
   */
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

  /**
   * Creates a new rule in the database
   * @param user_id - The ID of the user creating the rule
   * @param prompt - The text prompt for the rule
   * @returns Promise with the created rule data or error
   */
  async createRule(
    user_id: string,
    prompt: string
  ): Promise<{ data: Rule | null; error: any }> {
    try {
      const { data, error } = await this.supabase
        .from("berry_rules")
        .insert([
          {
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

  /**
   * Get all rules for a specific user
   * @param user_id - The ID of the user
   * @returns Promise with the user's rules or error
   */
  async getUserRules(
    user_id: string
  ): Promise<{ data: Rule[] | null; error: any }> {
    try {
      const { data, error } = await this.supabase
        .from("berry_rules")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching user rules:", error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error("Unexpected error fetching user rules:", error);
      return { data: null, error };
    }
  }

  /**
   * Delete a rule by ID
   * @param rule_id - The ID of the rule to delete
   * @returns Promise with the result or error
   */
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

  /**
   * Update a rule's cron_id
   */
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

// Export a singleton instance
export const supabaseService = new SupabaseService();
export type { Rule };
