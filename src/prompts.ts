import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized prompt builders used across the app.
 */

/**
 * Build a system/user instruction to transform a user's idea into a crisp rule prompt
 * suitable for periodic autonomous execution. The model should output only the final
 * prompt users want the model to run on schedule.
 */
export function buildRuleGenerationPrompt(userRequest: string): string {
  return [
    "You are a helpful assistant that writes precise prompts for an autonomous periodic agent.",
    "Given the user's rough idea, produce ONE clear, actionable prompt that:",
    "- Is self-contained (no placeholders).",
    "- Avoids unnecessary verbosity.",
    "- Is safe and appropriate for automated periodic execution.",
    "- Uses up-to-date, neutral phrasing.",
    "- The prompt should be a task that can be completed by the agent itself, possibly using the browser to search the web and returns text as a result. Do not have the task be to write a script or code or json or anything.",
    "Output ONLY the final prompt text, with no preamble or explanation.",
    "",
    `User request: ${userRequest}`,
  ].join("\n");
}

export function buildRuleExecutionPrompt(rulePrompt: string): string {
  return [
    `Your job is to output a conscise, answer to the request below. Your output will be read straight to the user so do not output code or anything else. Keep your answer casual, simple and to the point. Here is the rule prompt: ${rulePrompt}`,
  ].join("\n");
}
