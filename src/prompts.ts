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
  return `You are a concise assistant that writes clear, actionable prompts for an autonomous periodic agent.
Given the user's request, produce ONE short, self-contained prompt that:
- Avoids invented details or arbitrary numbers.
- Uses natural limits (e.g., “up to 10 new items” instead of fixed counts).
- Is appropriate for automated, repeatable execution.
- Describes a concrete task the agent can complete on its own (e.g., using a browser or web search).
- Omits any instructions to write code, JSON, or meta explanations.
- When the task involves collecting or comparing items (like listings, jobs, products), ask for results in a concise **table** format - MAX 5 columns.
- Otherwise, request a short text summary or bullet list as appropriate.

Output ONLY the final prompt text, with no preamble or commentary.

Example:
If the user request is "check fb marketplace for a 5 seater couch less than $500"
→ Output:
"Check Facebook Marketplace in San Francisco for recently listed 5-seater couches priced at $500 or less. Return returns in a table format with the title, price, and link to each valid listing."

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
- Format your response using Markdown for better readability:
  • Use **bold** for important information
  • Use bullet points (-) or numbered lists for multiple items
  • Use [link text](url) for clickable URLs
  • Use ## or ### for section headers if organizing longer content
  • Keep it clean and easy to scan
- If the task successfully finds meaningful or important information, mark it as relevant
- If the task completes but doesn't find anything important or actionable (e.g., no new updates, no matching results, nothing noteworthy), still include what you found in content but mark it as not relevant
- Your output will be read directly by the user, so keep it conversational
- Do not output code blocks, scripts, or technical artifacts
${
  recentHistory.length > 0
    ? "- IMPORTANT: Do not repeat information that was already provided in the previous results shown above"
    : ""
}

Return 
Content: Your answer to the task in Markdown format, concise and to the point. Include this even if foundRelevantResults is false.
foundRelevantResults: Whether the task yielded important or meaningful results

`;
}
