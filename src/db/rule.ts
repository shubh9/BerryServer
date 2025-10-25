import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Define the Rule type for better type safety
export interface Rule {
  id?: string;
  user_id: string;
  prompt: string;
  created_at?: string;
  updated_at?: string;
  cron_id?: string;
  history?: Array<{
    content: string;
    timestamp: string;
  }>;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);

/**
 * Get a single rule by ID
 */
export async function getRuleById(
  rule_id: string | number
): Promise<{ data: Rule | null; error: any }> {
  try {
    const { data, error } = await supabase
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
 * Create a new rule
 */
export async function createRule(
  user_id: string,
  prompt: string,
  rule_id?: string
): Promise<{ data: Rule | null; error: any }> {
  try {
    const { data, error } = await supabase
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

/**
 * Get all rules for a user
 */
export async function getUserRules(
  user_id: string
): Promise<{ data: Rule[] | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from("berry_rules")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user rules:", error);
      return { data: null, error };
    }

    console.log(`Fetched ${data?.length} user rules`);
    return { data, error: null };
  } catch (error) {
    console.error("Unexpected error fetching user rules:", error);
    return { data: null, error };
  }
}

/**
 * Delete a rule from the database
 */
export async function deleteRule(
  rule_id: string
): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from("berry_rules")
      .delete()
      .eq("id", rule_id);

    if (error) {
      console.error("Error deleting rule:", error);
      return { success: false, error };
    }

    console.log("Rule deleted successfully from database");
    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error deleting rule:", error);
    return { success: false, error };
  }
}

/**
 * Update a rule's cron_id
 */
export async function updateRuleCronId(
  rule_id: string,
  cron_id: string
): Promise<{ data: Rule | null; error: any }> {
  try {
    const { data, error } = await supabase
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

/**
 * Update a rule's history field
 */
export async function updateRuleHistory(
  rule_id: string,
  history: Array<{ content: string; timestamp: string }>
): Promise<{ data: Rule | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from("berry_rules")
      .update({ history })
      .eq("id", rule_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating rule history:", error);
      return { data: null, error };
    }

    console.log("Rule history updated successfully");
    return { data, error: null };
  } catch (error) {
    console.error("Unexpected error updating rule history:", error);
    return { data: null, error };
  }
}
