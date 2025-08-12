import OpenAI from "openai";
import dotenv from "dotenv";
import { chromium, Browser, Page } from "playwright";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple logger for consistent output
function log(...args: any[]): void {
  console.log("[LLMService]", ...args);
}

/**
 * Launch a sandboxed Chromium browser instance using Playwright.
 * The browser runs with minimal permissions to reduce security risks.
 */
async function launchSandboxedBrowser(): Promise<{
  browser: Browser;
  page: Page;
}> {
  const browser = await chromium.launch({
    headless: false,
    chromiumSandbox: true,
    env: {},
    args: ["--disable-extensions", "--disable-file-system"],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 768 });
  log("Launched sandboxed browser");
  return { browser, page };
}

/**
 * Execute the computer action suggested by the model on the provided Playwright page.
 * Extend this handler as the API adds support for more action types.
 */
async function handleModelAction(page: Page, action: any): Promise<void> {
  log("handleModelAction invoked", action.type, action);
  switch (action.type) {
    case "click": {
      const { x, y, button = "left" } = action;
      log("click", { x, y, button });
      await page.mouse.click(x, y, { button });
      break;
    }
    case "double_click": {
      const { x, y, button = "left" } = action;
      log("double_click", { x, y, button });
      await page.mouse.dblclick(x, y, { button });
      break;
    }
    case "scroll": {
      const { x, y, scroll_x, scroll_y } = action;
      log("scroll", { x, y, scroll_x, scroll_y });
      await page.mouse.move(x, y);
      await page.evaluate(
        ({ sx, sy }: { sx: number; sy: number }) => window.scrollBy(sx, sy),
        {
          sx: scroll_x,
          sy: scroll_y,
        }
      );
      break;
    }
    case "type": {
      log("type", { text: action.text });
      await page.keyboard.type(action.text);
      break;
    }
    case "keypress": {
      log("keypress", { keys: action.keys });
      for (const key of action.keys) {
        await page.keyboard.press(key);
      }
      break;
    }
    case "wait": {
      log("wait", { duration: action.duration ?? 1000 });
      await page.waitForTimeout(action.duration ?? 1000);
      break;
    }
    case "open_url":
    case "goto":
    case "navigate": {
      const { url, wait_until = "load" } = action;
      log("navigate", { url, wait_until });
      if (!url || typeof url !== "string") {
        console.warn(
          `Missing or invalid URL in navigate action: ${JSON.stringify(action)}`
        );
        break;
      }
      try {
        await page.goto(url, { waitUntil: wait_until });
      } catch (err) {
        console.error(`Failed to navigate to ${url}:`, err);
      }
      break;
    }
    // The model occasionally requests a screenshot itself; noop in that case.
    case "screenshot": {
      break;
    }
    default: {
      console.warn(`Unrecognized action type: ${action.type}`);
    }
  }
}

/**
 * Capture a screenshot of the current browser state and return a base-64 string.
 */
async function captureScreenshot(page: Page): Promise<string> {
  log("Capturing screenshot");
  const buffer = await page.screenshot({ fullPage: true });
  return buffer.toString("base64");
}

/**
 * Run the computer-use loop for the given prompt.
 *
 * @param prompt A natural-language instruction describing the task to automate.
 * @returns Whatever free-text output the model produces after it finishes acting.
 */
export async function runComputerUseAgent(prompt: string): Promise<string> {
  log("runComputerUseAgent started", prompt);
  const { browser, page } = await launchSandboxedBrowser();
  let step = 0;

  try {
    // FIRST REQUEST ---------------------------------------------------------
    let response: any = await openai.responses.create({
      model: "computer-use-preview",
      tools: [
        {
          type: "computer_use_preview",
          display_width: 1024,
          display_height: 768,
          environment: "browser",
        } as any,
      ],
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      reasoning: { summary: "concise" },
      truncation: "auto",
    });

    // MAIN LOOP -------------------------------------------------------------
    while (true) {
      step += 1;
      console.log("response", response);
      const computerCall = response.output?.find(
        (item: any) => item.type === "computer_call"
      );

      // When the model stops issuing computer calls, we consider the task done.
      if (!computerCall) {
        log("No more computer calls, agent finished after", step, "steps");
        // Combine any text outputs into a single string and return.
        const textParts = response.output
          ?.filter(
            (item: any) => item.type === "text" || item.type === "reasoning"
          )
          .map((item: any) => item.text ?? item.summary?.[0]?.text ?? "");
        return textParts?.join("\n") ?? "";
      }

      const { action, call_id } = computerCall;
      log(`Step ${step}: executing action`, action.type, "call_id", call_id);

      // Execute the action in the local browser.
      await handleModelAction(page, action);
      // Give the UI a moment to update.
      await page.waitForTimeout(750);

      // Take a screenshot reflecting the new state.
      const screenshotBase64 = await captureScreenshot(page);
      log("Screenshot captured, sending back to model");

      // Before sending the screenshot back, collect any pending safety checks to acknowledge
      const acknowledgedSafety = computerCall.pending_safety_checks ?? [];

      // Send the screenshot back to the model.
      response = await openai.responses.create({
        model: "computer-use-preview",
        previous_response_id: response.id,
        tools: [
          {
            type: "computer_use_preview",
            display_width: 1024,
            display_height: 768,
            environment: "browser",
          } as any,
        ],
        input: [
          {
            call_id,
            type: "computer_call_output",
            acknowledged_safety_checks: acknowledgedSafety,
            output: {
              type: "input_image",
              image_url: `data:image/png;base64,${screenshotBase64}`,
            },
          } as any,
        ],
        truncation: "auto",
      } as any);
    }
  } finally {
    await browser.close();
  }
}
