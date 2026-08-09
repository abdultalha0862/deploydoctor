import { GoogleGenAI } from "@google/genai";
import type { Diagnosis, Severity } from "./analyzer.js";

const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function normalizeSeverity(value: unknown): Severity {
  const upper = String(value ?? "").toUpperCase();
  return (SEVERITIES as string[]).includes(upper)
    ? (upper as Severity)
    : "MEDIUM";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

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
  "recommendation": "The single most important action to fix or investigate the issue.",
  "nextSteps": [
    "An ordered, concrete step the developer should take."
  ],
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",
  "category": "A short uppercase label such as DATABASE, CACHE, DOCKER, KUBERNETES, NETWORK, RUNTIME, CONFIG, or SYSTEM.",
  "confidence": 0.0
}

Rules:
- Base the diagnosis only on the supplied incident information.
- Do not invent logs, infrastructure, or configuration.
- If the evidence is insufficient, explicitly say so.
- severity must be one of LOW, MEDIUM, HIGH, or CRITICAL.
- category must be a single short uppercase word.
- nextSteps must be an ordered list of 2-4 concrete actions.
- confidence must be a number between 0 and 1.
- Keep every field concise and actionable.
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

  const parsed = JSON.parse(cleaned) as Partial<Diagnosis>;

  const confidence =
    typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.5;

  return {
    diagnosis: parsed.diagnosis ?? "Unable to determine the failure.",
    likelyCause: parsed.likelyCause ?? "The root cause could not be identified.",
    evidence: toStringArray(parsed.evidence),
    recommendation:
      parsed.recommendation ?? "Review the full logs and deployment context.",
    nextSteps: toStringArray(parsed.nextSteps),
    severity: normalizeSeverity(parsed.severity),
    category: parsed.category ? String(parsed.category).toUpperCase() : "GENERAL",
    confidence,
  };
}
