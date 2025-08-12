import express from "express";
import type { Request, Response } from "express";
import { supabaseService } from "./services/supabaseService.js";
import { qstashService } from "./services/qstashService.js";
import { generate as openaiGenerate } from "./services/openaiService.js";

const ruleRouter = express.Router();

// POST /rule - Create a new rule and schedule execution via QStash
ruleRouter.post("/", async (req: Request, res: Response) => {
  const { userId, textPrompt } = req.body as {
    userId?: string;
    textPrompt?: string;
  };

  const minutes = 1;

  // Validate required fields
  if (!userId || !textPrompt) {
    return res.status(400).json({
      error: "Missing required fields: userId and textPrompt are required",
    });
  }

  console.log("POST /rule received:");
  console.log("userId:", userId);
  console.log("textPrompt:", textPrompt);

  try {
    // Create rule in Supabase
    const { data, error } = await supabaseService.createRule(
      userId,
      textPrompt
    );

    if (error || !data?.id) {
      console.error("Failed to create rule:", error);
      return res.status(500).json({
        error: "Failed to create rule",
        details: (error as any)?.message || error,
      });
    }

    // Schedule execution with QStash
    const schedule = await qstashService.scheduleExecution(data.id, minutes);
    console.log("successfully scheduled execution", schedule);
    if (schedule?.scheduleId) {
      await supabaseService.updateRuleCronId(data.id, schedule.scheduleId);
    }

    res.status(201).json({
      message: "Rule created successfully",
      rule: {
        ...data,
        cron_id: schedule?.scheduleId,
        frequency_minutes: minutes,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// POST /rule/execute - Endpoint called by QStash schedule
ruleRouter.post("/execute", async (req: Request, res: Response) => {
  try {
    const signature = (req.headers["upstash-signature"] as string) || undefined;
    type RequestWithRawBody = Request & { rawBody?: Buffer };
    const rawBody: Buffer | undefined = (req as RequestWithRawBody).rawBody;

    if (signature) {
      if (!rawBody) {
        return res
          .status(400)
          .json({ error: "Missing raw body for signature verification" });
      }
      const ok = await qstashService.verifySignature(rawBody, signature);
      if (!ok) {
        return res.status(401).json({ error: "Invalid QStash signature" });
      }
    }

    const payload =
      rawBody && rawBody.length
        ? JSON.parse(rawBody.toString("utf8"))
        : req.body || {};

    const { ruleId } = payload;
    console.log("[/rule/execute] invoked", {
      ruleId,
      at: new Date().toISOString(),
      from: signature ? "qstash" : "manual",
    });

    if (!ruleId) {
      return res.status(400).json({ error: "Missing ruleId in payload" });
    }

    // Fetch rule from Supabase
    const { data: rule, error } = await supabaseService.getRuleById(ruleId);
    if (error) {
      console.error("Failed to fetch rule:", error);
      return res.status(500).json({ error: "Failed to fetch rule" });
    }
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    console.log("running rule", rule);
    // Call OpenAI with the rule's prompt
    try {
      const responseText = await openaiGenerate(rule.prompt);
      console.log("[rule execution result]", {
        ruleId,
        prompt: rule.prompt,
        response: responseText,
      });
    } catch (err) {
      console.error("OpenAI generation failed:", err);
      return res.status(502).json({ error: "OpenAI generation failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Error handling /rule/execute:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { ruleRouter };
