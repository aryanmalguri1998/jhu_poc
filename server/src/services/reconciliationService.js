import { z } from "zod";
import env from "../config/env.js";
import { getOpenAIClient, hasOpenAIClient } from "../config/openai.js";
import { extractFirstTextContent } from "../utils/openaiHelpers.js";
import {
  OUTCOME_ENVIRONMENTS,
  createOutcomeCounters,
  formatOutcomePrompt,
  applyOutcomeUpdates,
  getOutcomePromptConfig,
  buildPatientNarrative,
} from "./outcomePrompts.js";
import {
  ensureConversation,
  appendToConversation,
  getConversationSnapshot,
} from "./conversationStore.js";

const reconciliationPayloadSchema = z.object({
  predictions: z.array(z.record(z.any())).min(1, "Predictions are required"),
  groundTruth: z.array(z.record(z.any())).min(1, "Ground truth is required"),
  runId: z.string().optional(),
  conversationId: z.string().optional(),
  outcomePreviewOnly: z.boolean().optional(),
  environment: z
    .enum(Object.values(OUTCOME_ENVIRONMENTS))
    .default(OUTCOME_ENVIRONMENTS.ROUTINE_CARE)
    .optional(),
});

const getPatientId = (record = {}) =>
  String(
    record.patient_id ||
      record.PatientID ||
      record.PatientId ||
      record.id ||
      record.ID ||
      record.patientId ||
      ""
  ).trim();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeDiagnosis = (value) => {
  if (!value && value !== 0) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  const hasStroke = text.includes("stroke");
  const hasNon = text.includes("non-stroke") || text.includes("non stroke");
  if (hasNon) return "non-stroke";
  if (hasStroke) return "stroke";
  return text;
};

const buildIndex = (records) => {
  const index = new Map();
  records.forEach((record, idx) => {
    const id = getPatientId(record) || `row-${idx}`;
    index.set(id, record);
  });
  return index;
};

export async function reconcile(payload) {
  const {
    predictions,
    groundTruth,
    runId,
    conversationId,
    outcomePreviewOnly,
    environment = OUTCOME_ENVIRONMENTS.ROUTINE_CARE,
  } = reconciliationPayloadSchema.parse(payload);

  const conversationIdentifier =
    conversationId?.trim() || runId?.trim() || null;

  const truthIndex = buildIndex(groundTruth);
  const matches = [];
  const mismatches = [];
  const riskScores = [];
  const patientMetrics = [];
  const detailedPatientData = [];
  const outcomeEvents = [];
  const outcomeCounters = createOutcomeCounters();

  for (let predIndex = 0; predIndex < predictions.length; predIndex += 1) {
    const prediction = predictions[predIndex];
    const patientId = getPatientId(prediction) || `prediction-${predIndex + 1}`;
    const truth = truthIndex.get(patientId);

    if (truth) {
      const predictedRisk = toNumber(
        prediction.risk_score ?? prediction.RiskScore,
        0
      );
      const truthRisk = toNumber(truth.risk_score ?? truth.RiskScore, 0);
      const diff = Number((predictedRisk - truthRisk).toFixed(1));
      const predictedDiagnosis =
        prediction.predicted_diagnosis ||
        prediction.Diagnosis ||
        prediction.finalDiagnosis ||
        "Unknown";
      const groundTruthDiagnosis =
        truth.FinalDiagnosis ||
        truth.Diagnosis ||
        truth.finalDiagnosis ||
        "Unknown";

      const predictedDiagnosisNorm = normalizeDiagnosis(predictedDiagnosis);
      const groundTruthDiagnosisNorm = normalizeDiagnosis(groundTruthDiagnosis);

      const matchObject = {
        patientId,
        predictedDiagnosis,
        groundTruthDiagnosis,
        predictedRisk,
        groundTruthRisk: truthRisk,
        delta: diff,
      };

      const diagnosesMatch =
        predictedDiagnosisNorm && groundTruthDiagnosisNorm
          ? predictedDiagnosisNorm === groundTruthDiagnosisNorm
          : predictedDiagnosis === groundTruthDiagnosis;

      const isMatch = diagnosesMatch;

      if (isMatch) {
        matches.push(matchObject);
      } else {
        mismatches.push({
          recordIndex: predIndex + 1,
          patientId,
          field: "Diagnosis",
          processed: predictedDiagnosis,
          groundTruth: groundTruthDiagnosis,
          delta: diff,
        });
      }

      riskScores.push({
        patient: patientId,
        predicted: predictedRisk,
        groundTruth: truthRisk,
      });

      patientMetrics.push({
        patientId,
        match: isMatch,
        delta: diff,
      });

      detailedPatientData.push({
        patientId,
        processedRecord: prediction,
        groundTruthRecord: truth,
        clinicalSummary: {
          primarySymptoms: prediction.Symptoms || truth.Symptoms || "",
          diagnosis: predictedDiagnosis,
          notes: prediction.reasoning || truth.Notes || "",
        },
      });

      const truthStroke = getTruthStroke(truth);
      const predictedStroke = getPredictedStrokeFlag(prediction);
      const scenarioKey = determineRoutineScenario(
        truthStroke,
        predictedStroke
      );

      if (scenarioKey) {
        const outcomeEvent = await buildOutcomeEvent({
          scenarioKey,
          environment,
          patientId,
          counters: outcomeCounters,
          truthStroke,
          predictedStroke,
          previewOnly: Boolean(outcomePreviewOnly),
          conversationId: conversationIdentifier,
        });
        if (outcomeEvent) {
          outcomeEvents.push(outcomeEvent);
        }
      }
    } else {
      mismatches.push({
        recordIndex: predIndex + 1,
        patientId,
        field: "MissingGroundTruth",
        processed: prediction,
        groundTruth: null,
      });
    }
  }

  const summary = {
    runId,
    totalRecords: predictions.length,
    matchCount: matches.length,
    mismatchCount: mismatches.length,
    matchPercentage: Number(
      ((matches.length / predictions.length) * 100).toFixed(1)
    ),
    mismatchPercentage: Number(
      ((mismatches.length / predictions.length) * 100).toFixed(1)
    ),
  };

  const outcomeSummary = {
    strokesDetected: outcomeCounters.detected,
    strokesMissed: outcomeCounters.missed,
    correctDiagnoses: outcomeCounters.correct,
    incorrectDiagnoses: outcomeCounters.incorrect,
  };

  const errorTypes = [
    {
      type: "RiskScore",
      count: mismatches.filter((m) => m.field === "RiskScore").length,
    },
    {
      type: "Diagnosis",
      count: mismatches.filter((m) => m.field === "Diagnosis").length,
    },
    {
      type: "MissingGroundTruth",
      count: mismatches.filter((m) => m.field === "MissingGroundTruth").length,
    },
  ].filter((item) => item.count > 0);

  const timeSeriesData = Array.from({ length: 6 }).map((_, idx) => ({
    label: `Week ${idx + 1}`,
    accuracy: 60 + idx * 5,
  }));

  const feedback = mismatchFeedback(matches.length, mismatches.length);

  return {
    summary,
    matches,
    mismatches,
    errorTypes,
    riskScores,
    timeSeriesData,
    patientMetrics,
    detailedPatientData,
    feedback,
    outcomeSummary,
    outcomeEvents,
    environment,
    conversationId: conversationIdentifier || undefined,
  };
}

function mismatchFeedback(matchesCount, mismatchCount) {
  if (mismatchCount === 0) {
    return "All predictions aligned with ground truth. Continue collecting cases to stress-test edge scenarios.";
  }

  const total = matchesCount + mismatchCount;
  const accuracy = total === 0 ? 0 : matchesCount / total;
  if (accuracy > 0.8) {
    return "Model is close to production-ready. Focus on narrowing risk score deltas where disagreements persist.";
  }
  if (accuracy > 0.5) {
    return "Model shows moderate agreement. Investigate diagnostic disagreements and verify prompt guards for atypical vertigo presentations.";
  }
  return "Model requires prompt or fine-tuning adjustments before clinical validation. Review mismatched patients in detail.";
}

function getTruthStroke(record = {}) {
  if (typeof record.trueStroke === "boolean") {
    return record.trueStroke;
  }

  const candidates = [
    record["True Stroke?"],
    record["True Stroke"],
    record.FinalDiagnosis,
    record.Diagnosis,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "boolean") return candidate;
    const normalized = String(candidate).trim().toLowerCase();
    if (!normalized) continue;
    if (["yes", "y", "true", "1"].includes(normalized)) return true;
    if (["no", "n", "false", "0"].includes(normalized)) return false;
    if (
      normalized.includes("non-stroke") ||
      normalized.includes("non stroke")
    ) {
      return false;
    }
    if (normalized.includes("stroke")) {
      return true;
    }
  }

  return undefined;
}

function getPredictedStrokeFlag(record = {}) {
  const candidate =
    record.predicted_diagnosis ||
    record.Diagnosis ||
    record.finalDiagnosis ||
    record.final_stroke_probability;

  if (typeof candidate === "boolean") return candidate;
  if (candidate === undefined || candidate === null) return undefined;

  const normalized = String(candidate).trim().toLowerCase();
  if (!normalized) return undefined;

  const mentionsNonStroke =
    normalized.includes("non-stroke") || normalized.includes("non stroke");
  const mentionsStroke = normalized.includes("stroke");

  if (mentionsNonStroke && !mentionsStroke) return false;
  if (mentionsStroke && !mentionsNonStroke) return true;
  if (mentionsNonStroke && mentionsStroke) return false;

  return undefined;
}

function determineRoutineScenario(truthStroke, predictedStroke) {
  if (
    typeof truthStroke !== "boolean" ||
    typeof predictedStroke !== "boolean"
  ) {
    return null;
  }

  if (truthStroke && predictedStroke) return "stroke_detected";
  if (truthStroke && !predictedStroke) return "stroke_missed";
  if (!truthStroke && predictedStroke) return "false_positive";
  if (!truthStroke && !predictedStroke) return "true_negative";
  return null;
}

async function buildOutcomeEvent({
  scenarioKey,
  environment,
  patientId,
  counters,
  truthStroke,
  predictedStroke,
  previewOnly = false,
  conversationId,
}) {
  const config = getOutcomePromptConfig(environment, scenarioKey);
  if (!config) return null;

  const before = { ...counters };
  const after = applyOutcomeUpdates(before, config.updates);
  const patientNarrative = buildPatientNarrative({
    patientId,
    truthStroke,
    predictedStroke,
  });
  const promptText = formatOutcomePrompt(config, {
    before,
    after,
    patientNarrative,
  });

  const response = previewOnly
    ? { provider: "pending", output: null }
    : await dispatchOutcomePrompt({
        promptText,
        conversationId,
      });

  counters.detected = after.detected;
  counters.missed = after.missed;
  counters.correct = after.correct;
  counters.incorrect = after.incorrect;

  return {
    patientId,
    scenario: scenarioKey,
    environment,
    promptTitle: config.title,
    promptText,
    response: response.output,
    responseProvider: response.provider,
    variablesBefore: before,
    variablesAfter: after,
    truthStroke,
    predictedStroke,
  };
}

export {
  getPatientId,
  getTruthStroke,
  getPredictedStrokeFlag,
  determineRoutineScenario,
};

const outcomePromptSchema = z.object({
  promptText: z.string().min(10, "promptText is required"),
  conversationId: z.string().min(1, "conversationId is required"),
});

export async function sendOutcomePrompt(payload) {
  const { promptText, conversationId } = outcomePromptSchema.parse(payload);
  return dispatchOutcomePrompt({ promptText, conversationId });
}

async function dispatchOutcomePrompt({ promptText, conversationId }) {
  if (!promptText) {
    return { provider: "skipped", output: null, reason: "prompt missing" };
  }

  const identifier = conversationId?.trim();
  if (!identifier) {
    return {
      provider: "skipped",
      output: null,
      reason: "conversationId missing",
    };
  }

  const fallbackSystemPrompt =
    "You are a neurologist agent receiving sequential outcome updates. Acknowledge each update briefly and reflect on safety metrics.";

  ensureConversation(identifier, () => [
    { role: "system", content: fallbackSystemPrompt },
  ]);

  const userMessage = { role: "user", content: promptText };

  if (!hasOpenAIClient()) {
    const mockResponse =
      "OPENAI_API_KEY missing. Outcome prompt recorded without LLM acknowledgement.";
    appendToConversation(identifier, [
      userMessage,
      { role: "assistant", content: mockResponse },
    ]);
    return { provider: "mock", output: mockResponse };
  }

  try {
    const client = getOpenAIClient();
    const history = getConversationSnapshot(identifier);
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [...history, userMessage],
      temperature: 0.7,
    });

    const acknowledgement =
      extractFirstTextContent(response) ||
      "Outcome prompt acknowledged without textual response.";

    appendToConversation(identifier, [
      userMessage,
      { role: "assistant", content: acknowledgement },
    ]);

    return { provider: "openai", output: acknowledgement };
  } catch (error) {
    const message =
      env.nodeEnv === "development"
        ? error?.message || "Outcome acknowledgement failed"
        : "Outcome acknowledgement failed";

    appendToConversation(identifier, [
      userMessage,
      { role: "assistant", content: `[error] ${message}` },
    ]);

    return { provider: "error", output: message };
  }
}
