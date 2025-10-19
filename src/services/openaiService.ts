import OpenAI from "openai";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generate(prompt: string, schema?: any): Promise<any> {
  try {
    const hasSchema = Boolean(schema);
    const jsonSchema = hasSchema ? schema : undefined;

    const request: any = {
      model: "gpt-5",
      input: prompt,
      tools: [{ type: "web_search" }],
    };

    if (jsonSchema) {
      request.text = {
        format: {
          type: "json_schema",
          name: "response_schema",
          schema: jsonSchema,
          strict: true,
        },
      };
    }

    const response = await openai.responses.create(request);

    const text =
      (response as any).output_text ?? (response as any).output?.[0]?.text;

    if (!hasSchema) {
      return text || "No response generated";
    }

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      // If parsing fails, just return raw text
      return text || {};
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(`OpenAI API failed: ${error}`);
  }
}

export async function deepgenerate(prompt: string): Promise<string> {
  try {
    const response = await openai.responses.create({
      model: "o3-deep-research-2025-06-26", // deep-research reasoning model
      input: prompt,
      tools: [{ type: "web_search_preview", search_context_size: "medium" }],
    } as any);
    const text =
      (response as any).output_text ?? (response as any).output?.[0]?.text;
    return text || "No response generated";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(`OpenAI API failed: ${error}`);
  }
}
