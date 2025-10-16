import { Client, Receiver } from "@upstash/qstash";
import dotenv from "dotenv";

dotenv.config();

class QStashService {
  private client: Client;
  private receiver: Receiver;

  constructor() {
    // Log all environment variable keys
    const token = process.env.QSTASH_TOKEN;
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (!token || !currentKey || !nextKey) {
      throw new Error(
        "Missing QStash env: QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, and QSTASH_NEXT_SIGNING_KEY are required"
      );
    }

    this.client = new Client({ token });
    this.receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    });
  }

  /**
   * Create a recurring schedule that posts to /rule/execute.
   * Accepts one of the fixed intervals: "per_minute", "hourly", "daily", "weekly".
   */
  async scheduleExecution(
    ruleId: string,
    cadence: "per_minute" | "hourly" | "daily" | "weekly"
  ) {
    console.log(
      "Scheduling execution for ruleId",
      ruleId,
      "with cadence",
      cadence
    );
    const baseUrl = process.env.QSTASH_DESTINATION_BASE_URL;
    if (!baseUrl) {
      throw new Error(
        "Missing QSTASH_DESTINATION_BASE_URL for QStash destination"
      );
    }
    const destination = `${baseUrl}/rule/execute`;

    // Build cron expression from cadence
    let cron: string;
    // String-based fixed intervals
    const normalized = String(cadence).toLowerCase().replace(/\s+/g, "_");
    switch (normalized) {
      case "per_minute":
      case "minute":
      case "minutely":
        cron = "* * * * *"; // every minute
        break;
      case "hourly":
      case "hour":
        cron = "0 * * * *"; // top of every hour
        break;
      case "daily":
      case "day":
        cron = "0 0 * * *"; // midnight UTC every day
        break;
      case "weekly":
      case "week":
        cron = "0 0 * * 0"; // midnight UTC every Sunday
        break;
      default:
        throw new Error(
          `Unsupported cadence: ${cadence}. Use one of per_minute, hourly, daily, weekly`
        );
    }

    const schedule = await this.client.schedules.create({
      destination,
      cron,
      retries: 3,
      body: JSON.stringify({ ruleId }),
    });

    return schedule; // contains .id
  }

  async verifySignature(rawBody: Buffer, signature?: string) {
    if (!signature) return false;
    const bodyString = rawBody.toString("utf8");
    await this.receiver.verify({ body: bodyString, signature });
    return true;
  }

  /**
   * Get schedule details by schedule ID
   */
  async getSchedule(scheduleId: string) {
    try {
      const schedule = await this.client.schedules.get(scheduleId);
      return schedule;
    } catch (error) {
      console.error("Error fetching schedule:", error);
      return null;
    }
  }

  /**
   * Convert cron expression to human-readable frequency
   */
  cronToFrequency(cron: string): string {
    switch (cron) {
      case "* * * * *":
      case "*/1 * * * *":
        return "Every minute";
      case "0 * * * *":
        return "Hourly";
      case "0 0 * * *":
        return "Daily";
      case "0 0 * * 0":
        return "Weekly";
      default:
        return cron; // Return the cron expression if not a known pattern
    }
  }
}

export const qstashService = new QStashService();
