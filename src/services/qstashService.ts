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
   * Create a recurring schedule that posts to /rule/execute every `frequencyMinutes` minutes.
   * Only supports values from 1 to 60.
   */
  async scheduleExecution(ruleId: string, frequencyMinutes: number) {
    console.log(
      "Scheduling execution for ruleId",
      ruleId,
      "with frequency",
      frequencyMinutes
    );
    const baseUrl = process.env.QSTASH_DESTINATION_BASE_URL;
    if (!baseUrl) {
      throw new Error(
        "Missing QSTASH_DESTINATION_BASE_URL for QStash destination"
      );
    }
    const destination = `${baseUrl}/rule/execute`;

    // Clamp and normalize frequency
    let minutes = Number.isFinite(frequencyMinutes)
      ? Math.max(1, Math.min(60, Math.floor(frequencyMinutes)))
      : 60;

    // Build cron expression
    const cron = minutes === 60 ? "0 * * * *" : `*/${minutes} * * * *`;

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
}

export const qstashService = new QStashService();
