import * as openaiService from "./openaiService";
import * as perplexityService from "./perplexityService";
import readline from "readline";

async function runBrowsingTest() {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt: string = await new Promise((resolve) => {
    rl.question("Enter your prompt: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!prompt) {
    console.error("Prompt cannot be empty");
    process.exit(1);
  }

  console.log(`Testing prompt: "${prompt}"\n`);

  try {
    console.log("🔍 Running OpenAI O3...");
    const openaiResult = await openaiService.generate(prompt);
    console.log("OpenAI Response:");
    console.log("================");
    console.log(openaiResult);
    console.log("\n");

    console.log("🔍 Running Perplexity...");
    const perplexityResult = await perplexityService.generate(prompt);
    console.log("Perplexity Response:");
    console.log("===================");
    console.log(perplexityResult);
    console.log("\n");

    console.log("✅ Both services completed successfully");
  } catch (error) {
    console.error("❌ Error during testing:", error);
    process.exit(1);
  }
}

runBrowsingTest();
