import { runComputerUseAgent } from "./services/operatorService.js";

async function main() {
  const prompt =
    "Open gametime and check prices for the soonest dv4d concert in sf";
  try {
    console.log("Sending prompt to OpenAI agent...");
    const result = await runComputerUseAgent(prompt);
    console.log("Agent result:\n", result);
  } catch (err) {
    console.error("Error running agent:", err);
    process.exitCode = 1;
  }
}

main();
