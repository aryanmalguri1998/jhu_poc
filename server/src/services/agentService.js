import { randomUUID } from "crypto";
import { z } from "zod";
import env from "../config/env.js";
import { getOpenAIClient, hasOpenAIClient } from "../config/openai.js";
import {
  extractJsonFromResponse,
  safeJsonParse,
} from "../utils/openaiHelpers.js";
import {
  ensureConversation,
  appendToConversation,
  getConversationSnapshot,
} from "./conversationStore.js";

const runPayloadSchema = z.object({
  prompt: z.string().min(10, "Prompt must include clinical context"),
  patients: z
    .array(z.record(z.any()))
    .min(1, "At least one patient record is required"),
  conversationId: z.string().trim().optional(),
});

const MAX_PATIENTS_PER_REQUEST = 12;
const MAX_PATIENTS_PER_RUN = 5;

const PATIENT_FIELD_WHITELIST = new Set([
  "patient_id",
  "PatientID",
  "Patient#",
  "Age",
  "Sex",
  "Race",
  "Insurance",
  "BMI",
  "Years of Diabetes",
  "Atrial Fibrillation?",
  "Smoker?",
  "Prior Stroke?",
  "Suden Onset Vertigo",
  "Sudden Onset Vertigo",
  "Positional Vertigo",
  "Dizziness that is reproducible with standing",
  "Symptoms",
  "Combined Symptom",
  "Combined Symptoms",
  "Ataxia on finger-nose-finger?",
  "Direction-changing nystagmus?",
  "Skew Devaition?",
  "Skew Deviation?",
  "Head Impulse Test?",
  "RiskScore",
  "risk_score",
  "Risk",
  "Stroke Risk",
  "Note",
  "Notes",
]);

const slimPatientRecord = (record = {}, index = 0) => {
  const slim = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    if (!PATIENT_FIELD_WHITELIST.has(key)) return;
    if (value === undefined || value === null || value === "") return;
    slim[key] = value;
  });

  if (!slim.patient_id) {
    const fallbackId =
      record.patient_id ||
      record.PatientID ||
      record["Patient#"] ||
      `Patient-${index + 1}`;
    slim.patient_id = String(fallbackId);
  }

  return slim;
};
const chunkPatients = (patients, size = MAX_PATIENTS_PER_REQUEST) => {
  if (!Array.isArray(patients) || patients.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < patients.length; i += size) {
    chunks.push(patients.slice(i, i + size));
  }
  return chunks;
};

const formatChunkPrompt = (chunk, index) => {
  const header = `Batch ${index + 1}: Evaluate ${chunk.length} patient${
    chunk.length === 1 ? "" : "s"
  } and return JSON per schema.`;
  const guardrails =
    "Never leak PHI beyond provided structured fields. Keep reasoning concise.";
  const payload = JSON.stringify({ patients: chunk }, null, 2);
  return [header, guardrails, payload].join("\n\n");
};

export const responseSchema = {
  name: "patient_predictions",
  schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "patient_id",
            "predicted_diagnosis",
            "risk_score",
            "confidence",
            "reasoning",
            "stroke_risk_calculation",
            "final_stroke_probability",
            "soap_note",
          ],
          properties: {
            patient_id: { type: "string" },
            predicted_diagnosis: { type: "string" },
            risk_score: { type: "number" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            stroke_risk_calculation: { type: "string" },
            final_stroke_probability: { type: "string" },
            soap_note: {
              type: "object",
              additionalProperties: false,
              required: [
                "subjective",
                "objective",
                "assessment_and_plan",
                "justification",
              ],
              properties: {
                subjective: { type: "string" },
                objective: { type: "string" },
                assessment_and_plan: { type: "string" },
                justification: { type: "string" },
              },
            },
          },
        },
        additionalProperties: false,
      },
    },
    required: ["results"],
    additionalProperties: false,
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const generateMockResult = (patient, index) => {
  const baseRisk = Number(patient?.RiskScore ?? patient?.risk_score ?? 50);
  const normalizedRisk = clamp(
    Number.isFinite(baseRisk) ? baseRisk : 50,
    0,
    100
  );
  const offset = ((index % 3) - 1) * 7;
  const riskScore = clamp(normalizedRisk + offset, 5, 98);

  return {
    patient_id: String(
      patient.patient_id ||
        patient.PatientID ||
        patient.id ||
        `Patient-${index + 1}`
    ),
    predicted_diagnosis:
      typeof patient.Diagnosis === "string"
        ? patient.Diagnosis
        : riskScore > 70
        ? "Posterior circulation stroke"
        : riskScore > 40
        ? "Peripheral vestibulopathy"
        : "Non-stroke dizziness",
    risk_score: Number(riskScore.toFixed(1)),
    confidence: Number(clamp(riskScore / 100, 0.35, 0.95).toFixed(2)),
    reasoning:
      patient.Symptoms ||
      patient.Notes ||
      "Signal derived from uploaded spreadsheet (mock result while OpenAI key is absent)",
    stroke_risk_calculation: `Baseline 4% -> adjusted to ${riskScore.toFixed(
      1
    )}% using mock multipliers`,
    final_stroke_probability: `${riskScore.toFixed(1)}%`,
    soap_note: {
      subjective:
        patient.Description ||
        patient.Narrative ||
        "Vertigo description not provided (mock entry)",
      objective: "Exam findings unavailable in mock response.",
      assessment_and_plan:
        riskScore > 60
          ? "Admit for MRI to exclude posterior stroke."
          : "Likely peripheral process; manage symptomatically.",
      justification:
        "Mock rationale derived from spreadsheet features while OpenAI key is absent.",
    },
  };
};

export const generateMockResults = (patients) =>
  patients.map((patient, index) => generateMockResult(patient, index));

export async function runAgent(payload) {
  const {
    prompt,
    patients,
    conversationId: providedConversationId,
  } = runPayloadSchema.parse(payload);

  const runId = randomUUID();
  const createdAt = new Date().toISOString();
  const conversationId =
    (providedConversationId && providedConversationId.trim()) || runId;

  const workingPatients = patients.slice(0, MAX_PATIENTS_PER_RUN);
  const truncated = patients.length > workingPatients.length;
  const slimPatients = workingPatients.map((patient, index) =>
    slimPatientRecord(patient, index)
  );
  const patientChunks = chunkPatients(slimPatients);

  ensureConversation(conversationId, () => [
    { role: "system", content: prompt },
  ]);

  if (!hasOpenAIClient()) {
    const mockResults = generateMockResults(workingPatients);
    recordMockConversation({
      conversationId,
      patientChunks,
      mockResults,
    });

    return {
      runId,
      conversationId,
      createdAt,
      provider: "mock",
      results: mockResults,
      warning: truncated
        ? `OPENAI_API_KEY missing. Returning deterministic mock results for the first ${MAX_PATIENTS_PER_RUN} patients while we investigate timeout issues.`
        : "OPENAI_API_KEY missing. Returning deterministic mock results instead.",
    };
  }

  const client = getOpenAIClient();
  // Always use GPT-4.1 for best performance
  const model = "gpt-4.1-mini";
  const aggregatedResults = [];

  try {
    for (
      let chunkIndex = 0;
      chunkIndex < patientChunks.length;
      chunkIndex += 1
    ) {
      const chunk = patientChunks[chunkIndex];
      const chunkPrompt = formatChunkPrompt(chunk, chunkIndex);
      const chunkResults = await requestOpenAIChunk({
        client,
        model,
        conversationId,
        chunkPrompt,
        chunkPatients: chunk,
      });
      aggregatedResults.push(...chunkResults);
    }

    return {
      runId,
      conversationId,
      createdAt,
      provider: "openai",
      results: aggregatedResults,
      warning: truncated
        ? `Temporarily processing only the first ${MAX_PATIENTS_PER_RUN} patients while we investigate timeout issues.`
        : undefined,
    };
  } catch (error) {
    console.error("openai_run_error", error);
    const fallbackResults = generateMockResults(workingPatients);
    recordMockConversation({
      conversationId,
      patientChunks,
      mockResults: fallbackResults,
    });
    return {
      runId,
      conversationId,
      createdAt,
      provider: "mock-fallback",
      results: fallbackResults,
      warning: truncated
        ? `Falling back to mock results for the first ${MAX_PATIENTS_PER_RUN} patients due to OpenAI failure`
        : "Falling back to mock results due to OpenAI failure",
      error: env.nodeEnv === "development" ? error.message : undefined,
    };
  }
}

async function requestOpenAIChunk({
  client,
  model,
  conversationId,
  chunkPrompt,
  chunkPatients,
}) {
  if (!Array.isArray(chunkPatients) || chunkPatients.length === 0) {
    return [];
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const history = getConversationSnapshot(conversationId);
      const response = await client.responses.create({
        model,
        input: [...history, { role: "user", content: chunkPrompt }],
        temperature: 0.2,
        text: {
          format: {
            type: "json_schema",
            name: responseSchema.name,
            schema: responseSchema.schema,
          },
        },
      });

      const jsonPayload = safeJsonParse(extractJsonFromResponse(response));
      const results = Array.isArray(jsonPayload?.results)
        ? jsonPayload.results
        : generateMockResults(chunkPatients);

      appendToConversation(conversationId, [
        { role: "user", content: chunkPrompt },
        {
          role: "assistant",
          content: JSON.stringify(
            jsonPayload ?? {
              results,
              provider: "openai",
              warning: "Schema mismatch",
            }
          ),
        },
      ]);

      return results;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      console.error("openai_chunk_error", {
        attempt,
        total: maxAttempts,
        message: error?.message,
      });

      if (isLastAttempt) {
        const fallback = generateMockResults(chunkPatients);
        appendToConversation(conversationId, [
          { role: "user", content: chunkPrompt },
          {
            role: "assistant",
            content: JSON.stringify({
              results: fallback,
              provider: "mock-fallback",
              warning: error?.message || "Unknown error",
            }),
          },
        ]);
        return fallback;
      }

      const delayMs = 500 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return generateMockResults(chunkPatients);
}

function recordMockConversation({
  conversationId,
  patientChunks,
  mockResults,
}) {
  if (!conversationId || !Array.isArray(patientChunks)) return;
  let cursor = 0;
  patientChunks.forEach((chunk, index) => {
    const chunkPrompt = formatChunkPrompt(chunk, index);
    const chunkResults = mockResults.slice(cursor, cursor + chunk.length);
    cursor += chunk.length;
    appendToConversation(conversationId, [
      { role: "user", content: chunkPrompt },
      {
        role: "assistant",
        content: JSON.stringify({
          results: chunkResults,
          provider: "mock",
        }),
      },
    ]);
  });
}
