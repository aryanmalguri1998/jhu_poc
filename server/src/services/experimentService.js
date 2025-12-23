import { randomUUID } from "crypto";
import { z } from "zod";
import env from "../config/env.js";
import { getOpenAIClient, hasOpenAIClient } from "../config/openai.js";
import {
  extractJsonFromResponse,
  safeJsonParse,
  extractFirstTextContent,
} from "../utils/openaiHelpers.js";
import { responseSchema, generateMockResult } from "./agentService.js";
import {
  OUTCOME_ENVIRONMENTS,
  createOutcomeCounters,
  formatOutcomePrompt,
  applyOutcomeUpdates,
  getOutcomePromptConfig,
} from "./outcomePrompts.js";
import {
  ensureConversation,
  appendToConversation,
  getConversationSnapshot,
} from "./conversationStore.js";
import {
  getPatientId,
  getTruthStroke,
  getPredictedStrokeFlag,
  determineRoutineScenario,
} from "./reconciliationService.js";

const experimentPayloadSchema = z.object({
  prompt: z.string().min(10, "Prompt must include clinical context"),
  patients: z.array(z.record(z.any())).min(1, "Patients are required"),
  groundTruth: z.array(z.record(z.any())).min(1, "Ground truth is required"),
  environment: z
    .enum(Object.values(OUTCOME_ENVIRONMENTS))
    .default(OUTCOME_ENVIRONMENTS.CLINICAL_TRIAL)
    .optional(),
  maxPatients: z.number().int().positive().optional(),
  conversationId: z.string().optional(),
});

export async function runExperiment(payload) {
  const {
    prompt,
    patients,
    groundTruth,
    environment = OUTCOME_ENVIRONMENTS.CLINICAL_TRIAL,
    maxPatients,
    conversationId: providedConversationId,
  } = experimentPayloadSchema.parse(payload);

  const runId = randomUUID();
  const createdAt = new Date().toISOString();
  const conversationId =
    (providedConversationId && providedConversationId.trim()) || runId;
  const truthIndex = buildTruthIndex(groundTruth);
  const limitedPatients =
    typeof maxPatients === "number" ? patients.slice(0, maxPatients) : patients;

  if (limitedPatients.length === 0) {
    throw new Error("No patients available after applying maxPatients filter");
  }

  ensureConversation(conversationId, () => [
    { role: "system", content: prompt },
  ]);

  if (!hasOpenAIClient()) {
    const mock = buildMockExperiment({
      patients: limitedPatients,
      truthIndex,
      environment,
      conversationId,
    });
    return {
      runId,
      createdAt,
      conversationId,
      provider: "mock",
      environment,
      ...mock,
    };
  }

  const client = getOpenAIClient();
  const counters = createOutcomeCounters();
  const patientResults = [];
  const outcomeEvents = [];
  const errors = [];

  for (let index = 0; index < limitedPatients.length; index += 1) {
    const patient = limitedPatients[index];
    const patientId = getPatientId(patient) || `Patient-${index + 1}`;
    const truth = truthIndex.get(patientId);

    const patientPrompt = formatPatientPrompt(patient, index);
    const history = getConversationSnapshot(conversationId);

    let llmResult;
    let rawAssistantMessage;

    try {
      const response = await client.responses.create({
        model: env.nodeEnv === "production" ? "gpt-4.1" : "gpt-4o-mini",
        input: [...history, { role: "user", content: patientPrompt }],
        text: {
          format: {
            type: "json_schema",
            name: responseSchema.name,
            schema: responseSchema.schema,
          },
        },
      });

      const jsonPayload = safeJsonParse(extractJsonFromResponse(response));
      const resultArray = Array.isArray(jsonPayload?.results)
        ? jsonPayload.results
        : [];
      llmResult = resultArray[0];
      rawAssistantMessage = JSON.stringify(jsonPayload);
    } catch (error) {
      errors.push({
        patientId,
        step: "diagnosis",
        message: error?.message || "Unknown error",
      });
      llmResult = generateMockResult(patient, index);
      rawAssistantMessage = JSON.stringify({
        results: [llmResult],
        warning: "OpenAI failure: substituted mock result",
      });
    }

    if (!llmResult) {
      llmResult = generateMockResult(patient, index);
    }

    appendToConversation(conversationId, [
      { role: "user", content: patientPrompt },
      { role: "assistant", content: rawAssistantMessage },
    ]);

    const truthStroke = getTruthStroke(truth);
    const predictedStroke = getPredictedStrokeFlag(llmResult);
    const scenarioKey = determineRoutineScenario(truthStroke, predictedStroke);

    const isCorrect = determineCorrectness({ truth, result: llmResult });
    const patientDataSnapshot = buildPatientSnapshot(patient);

    const outcomeRecord = {
      patientNumber: index + 1,
      patientId,
      patientData: patientDataSnapshot,
      llmDiagnosis: llmResult.predicted_diagnosis,
      actualDiagnosis: formatActualDiagnosis(truthStroke, truth),
      llmRiskScore: llmResult.risk_score,
      finalProbability: llmResult.final_stroke_probability,
      riskCalculation: llmResult.stroke_risk_calculation,
      soapNote: llmResult.soap_note,
      correct: isCorrect,
      scenario: scenarioKey,
      fullResponse: rawAssistantMessage,
    };

    if (scenarioKey) {
      const promptConfig = getOutcomePromptConfig(environment, scenarioKey);
      if (promptConfig) {
        const before = { ...counters };
        const after = applyOutcomeUpdates(before, promptConfig.updates);
        const promptText = formatOutcomePrompt(promptConfig, {
          before,
          after,
        });

        let acknowledgement = null;
        let provider = "openai";

        try {
          const outcomeHistory = getConversationSnapshot(conversationId);
          const acknowledgementResponse = await client.responses.create({
            model: env.nodeEnv === "production" ? "gpt-4.1" : "gpt-4o-mini",
            input: [...outcomeHistory, { role: "user", content: promptText }],
          });
          acknowledgement = extractFirstTextContent(acknowledgementResponse);
          appendToConversation(conversationId, [
            { role: "user", content: promptText },
            { role: "assistant", content: acknowledgement },
          ]);
        } catch (error) {
          provider = "error";
          acknowledgement =
            env.nodeEnv === "development"
              ? error?.message || "Outcome acknowledgement failed"
              : "Outcome acknowledgement failed";
          errors.push({
            patientId,
            step: "outcome",
            message: error?.message || "Unknown error",
          });
          appendToConversation(conversationId, [
            { role: "user", content: promptText },
            { role: "assistant", content: `[error] ${acknowledgement}` },
          ]);
        }

        counters.detected = after.detected;
        counters.missed = after.missed;
        counters.correct = after.correct;
        counters.incorrect = after.incorrect;

        outcomeEvents.push({
          patientId,
          scenario: scenarioKey,
          environment,
          promptTitle: promptConfig.title,
          promptText,
          response: acknowledgement,
          responseProvider: provider,
          variablesBefore: before,
          variablesAfter: after,
          truthStroke,
          predictedStroke,
        });

        outcomeRecord.outcomePrompt = promptText;
        outcomeRecord.outcomeResponse = acknowledgement;
      }
    }

    patientResults.push(outcomeRecord);
  }

  return {
    runId,
    createdAt,
    conversationId,
    provider: "openai",
    environment,
    patientResults,
    outcomeEvents,
    finalMetrics: {
      strokesDetected: counters.detected,
      strokesMissed: counters.missed,
      correctDiagnoses: counters.correct,
      incorrectDiagnoses: counters.incorrect,
    },
    errors,
  };
}

function buildTruthIndex(groundTruth) {
  const index = new Map();
  groundTruth.forEach((record, idx) => {
    const id = getPatientId(record) || `truth-${idx}`;
    index.set(id, record);
  });
  return index;
}

function determineCorrectness({ truth, result }) {
  if (!truth || !result) return false;
  const predicted = normalizeDiagnosisValue(result.predicted_diagnosis);
  const truthDiagnosis = normalizeDiagnosisValue(
    truth.FinalDiagnosis || truth.Diagnosis || truth.finalDiagnosis
  );

  if (predicted && truthDiagnosis) {
    return predicted === truthDiagnosis;
  }

  const truthStroke = getTruthStroke(truth);
  const predictedStroke = getPredictedStrokeFlag(result);
  if (
    typeof truthStroke === "boolean" &&
    typeof predictedStroke === "boolean"
  ) {
    return truthStroke === predictedStroke;
  }

  return false;
}

function formatActualDiagnosis(truthStroke, truthRecord) {
  if (typeof truthStroke === "boolean") {
    return truthStroke ? "Stroke" : "Non-stroke";
  }
  const text =
    truthRecord?.FinalDiagnosis ||
    truthRecord?.Diagnosis ||
    truthRecord?.finalDiagnosis ||
    "Unknown";
  return String(text);
}

function normalizeDiagnosisValue(value) {
  if (!value && value !== 0) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (text.includes("non-stroke") || text.includes("non stroke")) {
    return "non-stroke";
  }
  if (text.includes("stroke")) {
    return "stroke";
  }
  return text;
}

function formatPatientPrompt(patient, index) {
  const lines = [`[Patient ${index + 1}]`];
  const history =
    patient.History ||
    patient.history ||
    patient.Description ||
    patient.description ||
    null;
  if (history) {
    lines.push(`History: ${history}`);
  }

  const summaryPieces = [];
  if (patient.Age || patient.age) {
    summaryPieces.push(`Age ${patient.Age || patient.age}`);
  }
  if (patient.Sex || patient.sex) {
    summaryPieces.push(`Sex ${patient.Sex || patient.sex}`);
  }
  if (patient.Symptoms) {
    summaryPieces.push(`Symptoms: ${patient.Symptoms}`);
  }
  if (summaryPieces.length > 0) {
    lines.push(summaryPieces.join(" | "));
  }

  lines.push("Structured patient data:", JSON.stringify(patient, null, 2));

  lines.push(
    "Return JSON following the shared schema for this patient.",
    "Never leak ground truth labels or PHI beyond what is provided."
  );

  return lines.join("\n");
}

function buildPatientSnapshot(patient) {
  if (!patient || typeof patient !== "object") {
    return {
      presentation: "Patient data unavailable",
      raw: patient,
    };
  }
  const snapshot = { ...patient };
  if (!snapshot.presentation) {
    snapshot.presentation =
      snapshot.History ||
      snapshot.history ||
      snapshot.Description ||
      snapshot.description ||
      snapshot.Symptoms ||
      "Structured data provided above.";
  }
  return snapshot;
}

function buildMockExperiment({
  patients,
  truthIndex,
  environment,
  conversationId,
}) {
  const counters = createOutcomeCounters();
  const patientResults = [];
  const outcomeEvents = [];

  patients.forEach((patient, index) => {
    const patientId = getPatientId(patient) || `Patient-${index + 1}`;
    const truth = truthIndex.get(patientId);
    const mockResult = generateMockResult(patient, index);
    const truthStroke = getTruthStroke(truth);
    const predictedStroke = getPredictedStrokeFlag(mockResult);
    const scenarioKey = determineRoutineScenario(truthStroke, predictedStroke);
    const isCorrect = determineCorrectness({ truth, result: mockResult });

    const patientDataSnapshot = buildPatientSnapshot(patient);

    const outcomeRecord = {
      patientNumber: index + 1,
      patientId,
      patientData: patientDataSnapshot,
      llmDiagnosis: mockResult.predicted_diagnosis,
      actualDiagnosis: formatActualDiagnosis(truthStroke, truth),
      llmRiskScore: mockResult.risk_score,
      finalProbability: mockResult.final_stroke_probability,
      riskCalculation: mockResult.stroke_risk_calculation,
      soapNote: mockResult.soap_note,
      correct: isCorrect,
      scenario: scenarioKey,
      fullResponse: JSON.stringify({
        results: [mockResult],
        provider: "mock",
      }),
    };

    if (conversationId) {
      const patientPrompt = formatPatientPrompt(patient, index);
      appendToConversation(conversationId, [
        { role: "user", content: patientPrompt },
        {
          role: "assistant",
          content: JSON.stringify({
            results: [mockResult],
            provider: "mock",
          }),
        },
      ]);
    }

    if (scenarioKey) {
      const config = getOutcomePromptConfig(environment, scenarioKey);
      if (config) {
        const before = { ...counters };
        const after = applyOutcomeUpdates(before, config.updates);
        const promptText = formatOutcomePrompt(config, { before, after });
        counters.detected = after.detected;
        counters.missed = after.missed;
        counters.correct = after.correct;
        counters.incorrect = after.incorrect;

        outcomeEvents.push({
          patientId,
          scenario: scenarioKey,
          environment,
          promptTitle: config.title,
          promptText,
          response: "Mock acknowledgement",
          responseProvider: "mock",
          variablesBefore: before,
          variablesAfter: after,
          truthStroke,
          predictedStroke,
        });

        outcomeRecord.outcomePrompt = promptText;
        outcomeRecord.outcomeResponse = "Mock acknowledgement";

        if (conversationId) {
          appendToConversation(conversationId, [
            { role: "user", content: promptText },
            { role: "assistant", content: "Mock acknowledgement" },
          ]);
        }
      }
    }

    patientResults.push(outcomeRecord);
  });

  return {
    patientResults,
    outcomeEvents,
    finalMetrics: {
      strokesDetected: counters.detected,
      strokesMissed: counters.missed,
      correctDiagnoses: counters.correct,
      incorrectDiagnoses: counters.incorrect,
    },
    errors: [],
  };
}
