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
  return `You are a helpful assistant that writes precise prompts for an autonomous periodic agent.
Given the user's rough idea, produce ONE clear, actionable prompt that:
- Is self-contained (no placeholders).
- Avoids unnecessary verbosity.
- Is safe and appropriate for automated periodic execution.
- Uses up-to-date, neutral phrasing.
- The prompt should be a task that can be completed by the agent itself, possibly using the browser to search the web and returns text as a result. Do not have the task be to write a script or code or json or anything.
Output ONLY the final prompt text, with no preamble or explanation.


For example if the user request is:
"check fb marketplace for a 5 seater couch less than $500" 
The output should be:
"Check Facebook Marketplace in San Francisco for 5-seater couches recently listed and are $500 or less that are 5 seater. 
Return a bullet point list with a short overview of each valid listing and the facebook link to the listing."

User request: ${userRequest}`;
}

export function buildRuleExecutionPrompt(
  rulePrompt: string,
  history?: Array<{ content: string; timestamp: string }>
): string {
  // Get last 3 history items (content only)
  const recentHistory =
    history && history.length > 0
      ? history.slice(-3).map((item) => item.content)
      : [];

  let historySection = "";
  if (recentHistory.length > 0) {
    historySection = `
______________________________________________________________________________
Previous Results (DO NOT REPEAT):
The following are the last ${
      recentHistory.length
    } result(s) from previous executions of this task. 
Your new response should NOT repeat or duplicate information already covered in these previous results:

${recentHistory.map((content, idx) => `${idx + 1}. ${content}`).join("\n\n")}
END OF PREVIOUS RESULTS
______________________________________________________________________________
`;
  }

  return `Your job is to execute the following task and provide a concise answer.

  Task: ${rulePrompt}
${historySection}
______________________________________________________________________________
  Guidelines:
- Provide a casual, simple, and to-the-point response in the content field
- If the task successfully finds meaningful or important information, mark it as relevant
- If the task completes but doesn't find anything important or actionable (e.g., no new updates, no matching results, nothing noteworthy), still include what you found in content but mark it as not relevant
- Your output will be read directly by the user, so keep it conversational
- Do not output code, scripts, or technical artifacts unless specifically requested
${
  recentHistory.length > 0
    ? "- IMPORTANT: Do not repeat information that was already provided in the previous results shown above"
    : ""
}

Return 
Content: Your answer to the task, conscise and to the point. Include this even if foundRelevantResults is false.
foundRelevantResults: Whether the task yielded important or meaningful results

`;
}
