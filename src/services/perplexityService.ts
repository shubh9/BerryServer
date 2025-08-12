import * as dotenv from "dotenv";
dotenv.config();

interface PerplexityResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
}

export async function generate(prompt: string): Promise<string> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-deep-research",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Perplexity API error: ${response.status} ${response.statusText}`
      );
    }

    const data: PerplexityResponse = await response.json();
    return data.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    console.error("Perplexity API error:", error);
    throw new Error(`Perplexity API failed: ${error}`);
  }
}
