import express from "express";
import type { Request, Response } from "express";
import { ruleService } from "./services/ruleService.js";

const ruleRouter = express.Router();

// POST /rule - Create a new rule and schedule execution via QStash
ruleRouter.post("/", async (req: Request, res: Response) => {
  const { userId, textPrompt } = req.body as {
    userId?: string;
    textPrompt?: string;
  };

  // Validate required fields
  if (!userId || !textPrompt) {
    return res.status(400).json({
      error: "Missing required fields: userId and textPrompt are required",
    });
  }
  const result = await ruleService.handleCreate({ body: req.body });
  return res.status(result.status).json(result.body);
});

// POST /rule/execute - Endpoint called by QStash schedule
ruleRouter.post("/execute", async (req: Request, res: Response) => {
  const signature = (req.headers["upstash-signature"] as string) || undefined;
  type RequestWithRawBody = Request & { rawBody?: Buffer };
  const rawBody: Buffer | undefined = (req as RequestWithRawBody).rawBody;

  const result = await ruleService.handleExecute({
    rawBody,
    signature,
    body: req.body,
  });

  return res.status(result.status).json(result.body);
});

export { ruleRouter };
