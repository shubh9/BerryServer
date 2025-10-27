import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export interface NotificationRecord {
  id?: number;
  created_at?: string;
  user_id: string;
  rule_id: string;
  payload: any;
}

class NotificationService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        "Missing required env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  /**
   * Insert a new notification. created_at/id are database-generated.
   */
  async createNotification(
    user_id: string,
    rule_id: string,
    payload: Record<string, any>
  ): Promise<{ data: NotificationRecord | null; error: any }> {
    try {
      const { data, error } = await this.supabase
        .from("berry_notifications")
        .insert([{ user_id, rule_id, payload }])
        .select()
        .single();

      if (error) {
        console.error("Error creating notification:", error);
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      console.error("Unexpected error creating notification:", error);
      return { data: null, error };
    }
  }

  /**
   * Fetch notifications for a specific user, newest first.
   */
  async getNotificationsByUserId(userId: string): Promise<{
    data: NotificationRecord[] | null;
    error: any;
  }> {
    try {
      const { data, error } = await this.supabase
        .from("berry_notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      console.log(`Fetched ${data?.length} notifications for user ${userId}`);

      if (error) {
        console.error("Error fetching notifications:", error);
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      console.error("Unexpected error fetching notifications:", error);
      return { data: null, error };
    }
  }
}

export const notificationService = new NotificationService();
