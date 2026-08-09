import { GoogleGenAI } from "@google/genai";
import type { Diagnosis } from "./analyzer.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function analyzeWithAI(context: {
  title: string;
  description?: string | null;
  environment?: string | null;
  logs: string;
}): Promise<Diagnosis> {
  const prompt = `
You are DeployDoctor, an expert DevOps incident diagnosis assistant.

Analyze the following deployment/runtime incident.

Title:
${context.title}

Description:
${context.description ?? "Not provided"}

Environment:
${context.environment ?? "Not provided"}

Logs:
${context.logs}

Return ONLY valid JSON matching this structure:

{
  "diagnosis": "A concise explanation of what failed.",
  "likelyCause": "The most likely root cause.",
  "evidence": [
    "Specific evidence from the provided logs or context."
  ],
  "recommendation": "Concrete steps the developer should take to fix or investigate the issue.",
  "confidence": 0.0
}

Rules:
- Base the diagnosis only on the supplied incident information.
- Do not invent logs, infrastructure, or configuration.
- If the evidence is insufficient, explicitly say so.
- confidence must be a number between 0 and 1.
- Keep the response concise and actionable.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const diagnosis = JSON.parse(cleaned) as Diagnosis;

  return diagnosis;
}
