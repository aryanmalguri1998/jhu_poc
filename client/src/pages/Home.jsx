import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, CheckCircle2, AlertTriangle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import InputSelector from "@/components/InputSelector";
import FileUploader from "@/components/FileUploader";
import TextInput from "@/components/TextInput";
import DataTable from "@/components/DataTable";
import GroundTruthUpload from "@/components/GroundTruthUpload";
import ReconciliationResults from "@/components/ReconciliationResults";
import http from "@/api/http";
import {
  parseSpreadsheet,
  normalizePatientRows,
  numberLike,
  truthyStrokeValue,
} from "@/utils/excel";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/prompts";
import ExperimentResults from "@/components/experiment/ExperimentResults";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const SAMPLE_PATIENTS = [
  {
    patient_id: "P001",
    Age: 68,
    Sex: "Male",
    Diagnosis: "Posterior circulation stroke",
    RiskScore: 85,
    Symptoms: "Sudden vertigo, diplopia, truncal ataxia",
  },
  {
    patient_id: "P002",
    Age: 45,
    Sex: "Female",
    Diagnosis: "Peripheral vestibulopathy",
    RiskScore: 24,
    Symptoms: "Intermittent positional vertigo, no neuro deficits",
  },
  {
    patient_id: "P003",
    Age: 72,
    Sex: "Male",
    Diagnosis: "Non-stroke dizziness",
    RiskScore: 47,
    Symptoms: "Lightheaded, orthostatic changes",
  },
  {
    patient_id: "P004",
    Age: 55,
    Sex: "Female",
    Diagnosis: "Posterior circulation stroke",
    RiskScore: 79,
    Symptoms: "Acute imbalance, abnormal HINTS exam",
  },
];

const SAMPLE_GROUND_TRUTH = [
  {
    PatientID: "P001",
    RiskScore: 88,
    FinalDiagnosis: "Ischemic stroke",
    Notes: "MRI confirmed pontine infarct",
  },
  {
    PatientID: "P002",
    RiskScore: 18,
    FinalDiagnosis: "BPPV",
    Notes: "Canalith repositioning resolved symptoms",
  },
  {
    PatientID: "P003",
    RiskScore: 40,
    FinalDiagnosis: "Medication effect",
    Notes: "Symptoms improved after dosage change",
  },
  {
    PatientID: "P004",
    RiskScore: 82,
    FinalDiagnosis: "Cerebellar stroke",
    Notes: "CTA showed vertebral artery occlusion",
  },
];

const steps = [
  {
    id: 1,
    label: "Prepare Data",
    detail: "Upload Excel/CSV or paste patient rows",
  },
  {
    id: 2,
    label: "Configure Prompt",
    detail: "Inspect parsed data & tune the agent",
  },
  { id: 3, label: "Run Agent", detail: "Review structured results" },
  { id: 4, label: "Reconcile", detail: "Compare with ground truth & insights" },
];

const FEEDBACK_ENVIRONMENTS = [
  {
    value: "clinical_trial",
    label: "Clinical Trial",
    helper: "MRI for every patient; feedback on all outcomes.",
  },
  {
    value: "routine_care",
    label: "Routine Care",
    helper: "Missed strokes rarely surface; mimics day-to-day care.",
  },
];

const MAX_PATIENTS_PER_RUN = 5;

const parseFreeformText = (input) => {
  if (!input) return [];

  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0]
    .split(delimiter)
    .map((header, idx) => header.trim() || `Column ${idx + 1}`);

  return lines.slice(1).map((line, rowIdx) => {
    const values = line.split(delimiter);
    return headers.reduce(
      (acc, header, colIdx) => {
        acc[header] = values[colIdx]?.trim() ?? "";
        return acc;
      },
      { originalRowIndex: rowIdx }
    );
  });
};

const JsonPreview = ({ title, data }) => {
  if (!data || !data.length) return null;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold tracking-wide uppercase text-slate-400">
          {title}
        </h4>
        <span className="text-xs text-slate-500">Preview only</span>
      </div>
      <pre className="text-xs leading-relaxed max-h-72 overflow-auto">
        {JSON.stringify(data.slice(0, 3), null, 2)}
      </pre>
    </div>
  );
};

const buildGroundTruthPayload = (records = []) =>
  records.map((record, index) => {
    const patientNumber = String(
      record["Patient#"] || `Patient-${index + 1}`
    ).trim();
    const truthValue = truthyStrokeValue(record["True Stroke?"]);
    const strokeRisk = numberLike(record["Stroke Risk"]);

    const payload = {
      patient_id: patientNumber,
      PatientID: patientNumber,
      "Patient#": patientNumber,
      "True Stroke?": record["True Stroke?"] ?? "",
      "Stroke Risk": record["Stroke Risk"] ?? "",
    };

    if (typeof truthValue === "boolean") {
      payload.trueStroke = truthValue;
      payload.FinalDiagnosis = truthValue ? "Stroke" : "Non-Stroke";
    }

    if (typeof strokeRisk === "number") {
      payload.RiskScore = strokeRisk;
      payload.risk_score = strokeRisk;
    }

    return payload;
  });

const derivePatientIdentifier = (record, index) =>
  String(
    record?.patient_id ||
      record?.PatientID ||
      record?.["Patient#"] ||
      `Patient-${index + 1}`
  ).trim();

const AGENT_FIELD_BLOCKLIST = [
  /true stroke/i,
  /^stroke risk/i,
  /^risk(score)?$/i,
  /^risk score$/i,
  /^risk_score$/i,
  /^clinical (trail|trial) risk estimate/i,
  /^final diagnosis/i,
  /^true stroke percent chance/i,
];

const shouldExcludeAgentField = (key = "") => {
  const normalized = key.trim();
  if (!normalized) return true;
  return AGENT_FIELD_BLOCKLIST.some((pattern) => pattern.test(normalized));
};

const buildAgentPayload = (records = []) =>
  records.map((record, index) => {
    const patientId = derivePatientIdentifier(record, index);
    const payload = {};

    Object.entries(record || {}).forEach(([key, value]) => {
      const normalizedKey = key?.toString?.().trim();
      if (!normalizedKey) return;
      if (shouldExcludeAgentField(normalizedKey)) return;
      if (value === undefined || value === null || value === "") return;
      payload[normalizedKey] = value;
    });

    payload.patient_id = patientId;
    return payload;
  });

export default function Home() {
  const [inputMode, setInputMode] = useState(null);
  const [file, setFile] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [groundTruthFile, setGroundTruthFile] = useState(null);
  const [groundTruthData, setGroundTruthData] = useState(null);
  const [reconciliationResults, setReconciliationResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [agentPrompt, setAgentPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [agentResults, setAgentResults] = useState([]);
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [agentError, setAgentError] = useState(null);
  const [agentRunMetadata, setAgentRunMetadata] = useState(null);
  const [patientRangeStart, setPatientRangeStart] = useState(1);
  const [patientRangeEnd, setPatientRangeEnd] = useState(0);
  const [feedbackEnvironment, setFeedbackEnvironment] = useState(
    FEEDBACK_ENVIRONMENTS[0].value
  );
  const [isRunningExperiment, setIsRunningExperiment] = useState(false);
  const [experimentResults, setExperimentResults] = useState(null);
  const [experimentError, setExperimentError] = useState(null);

  const totalPatients = Array.isArray(processedData) ? processedData.length : 0;

  const rangeIsValid = useMemo(() => {
    if (!totalPatients) return false;
    const start = Number(patientRangeStart);
    const end = Number(patientRangeEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    if (start < 1) return false;
    if (end < start) return false;
    if (start > totalPatients) return false;
    if (end > totalPatients) return false;
    return true;
  }, [patientRangeStart, patientRangeEnd, totalPatients]);

  const selectedPatientCount = useMemo(() => {
    if (!rangeIsValid) return 0;
    return patientRangeEnd - patientRangeStart + 1;
  }, [rangeIsValid, patientRangeEnd, patientRangeStart]);

  const rangeWarning =
    selectedPatientCount > MAX_PATIENTS_PER_RUN
      ? `Only the first ${MAX_PATIENTS_PER_RUN} patients in the selected range will be processed while we address timeout limits.`
      : null;

  const canRunAgent = useMemo(
    () => totalPatients > 0 && rangeIsValid && agentPrompt.trim().length > 0,
    [totalPatients, rangeIsValid, agentPrompt]
  );

  useEffect(() => {
    if (totalPatients > 0) {
      setPatientRangeStart(1);
      setPatientRangeEnd(totalPatients);
    } else {
      setPatientRangeStart(1);
      setPatientRangeEnd(0);
    }
  }, [totalPatients]);

  const canReconcile = useMemo(
    () =>
      Array.isArray(agentResults) &&
      agentResults.length > 0 &&
      Array.isArray(groundTruthData) &&
      groundTruthData.length > 0,
    [agentResults, groundTruthData]
  );

  const canRunExperiment = useMemo(
    () =>
      Array.isArray(processedData) &&
      processedData.length > 0 &&
      Array.isArray(groundTruthData) &&
      groundTruthData.length > 0 &&
      agentPrompt.trim().length > 0,
    [processedData, groundTruthData, agentPrompt]
  );

  const resetWorkflow = () => {
    setInputMode(null);
    setFile(null);
    setProcessedData(null);
    setGroundTruthFile(null);
    setGroundTruthData(null);
    setReconciliationResults(null);
    setAgentResults([]);
    setAgentRunMetadata(null);
    setAgentError(null);
    setCurrentStep(1);
  };

  const hydrateProcessedData = (rows) => {
    // Clean for agent mode: remove unwanted fields
    const normalized = normalizePatientRows(rows, { mode: "agent" });
    setProcessedData(normalized);
    setReconciliationResults(null);
    setAgentResults([]);
    setAgentRunMetadata(null);
    setCurrentStep(2);
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      resetWorkflow();
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const rows = await parseSpreadsheet(selectedFile, { mode: "agent" });
      hydrateProcessedData(rows);
    } catch (error) {
      console.error("Unable to parse spreadsheet", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = (text) => {
    setIsProcessing(true);
    try {
      const rows = parseFreeformText(text);
      hydrateProcessedData(rows);
      setInputMode("text");
    } catch (error) {
      console.error("Unable to parse text", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGroundTruthSelect = async (selectedFile) => {
    if (!selectedFile) {
      setGroundTruthFile(null);
      setGroundTruthData(null);
      return;
    }

    setGroundTruthFile(selectedFile);
    setIsProcessing(true);
    try {
      const rows = await parseSpreadsheet(selectedFile, {
        mode: "groundTruth",
      });
      setGroundTruthData(normalizePatientRows(rows, { mode: "groundTruth" }));
      setCurrentStep(3);
    } catch (error) {
      console.error("Unable to parse ground truth", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunAgent = async () => {
    if (!canRunAgent) return;

    const startIndex = Math.max(
      0,
      Math.min(totalPatients - 1, patientRangeStart - 1)
    );
    const endIndexExclusive = Math.min(totalPatients, patientRangeEnd);
    const selectedPatients = processedData.slice(startIndex, endIndexExclusive);

    if (selectedPatients.length === 0) {
      setAgentError("No patients selected in the chosen range.");
      return;
    }

    setIsRunningAgent(true);
    setAgentError(null);
    setReconciliationResults(null);

    try {
      const { data } = await http.post("/agent/run", {
        prompt: agentPrompt,
        patients: selectedPatients,
        conversationId: agentRunMetadata?.conversationId,
      });

      setAgentResults(data.results || []);
      setAgentRunMetadata({
        runId: data.runId,
        conversationId: data.conversationId || data.runId,
        createdAt: data.createdAt,
      });
      setCurrentStep(3);
    } catch (error) {
      setAgentError(
        error?.response?.data?.message || error.message || "Unable to run agent"
      );
    } finally {
      setIsRunningAgent(false);
    }
  };

  const handleReconcile = async () => {
    if (!canReconcile) return;

    setIsReconciling(true);
    setReconciliationResults(null);

    try {
      const groundTruthPayload = buildGroundTruthPayload(groundTruthData);
      const { data } = await http.post("/agent/reconcile", {
        predictions: agentResults,
        groundTruth: groundTruthPayload,
        runId: agentRunMetadata?.runId,
        conversationId:
          agentRunMetadata?.conversationId || agentRunMetadata?.runId,
        outcomePreviewOnly: true,
      });

      setReconciliationResults(data);
      setCurrentStep(4);
    } catch (error) {
      console.error("Error reconciling data", error);
    } finally {
      setIsReconciling(false);
    }
  };

  const loadSampleData = () => {
    setInputMode("sample");
    hydrateProcessedData(SAMPLE_PATIENTS);
    setGroundTruthData(null);
    setGroundTruthFile(null);
  };

  const useSampleGroundTruth = () => {
    setGroundTruthData(SAMPLE_GROUND_TRUTH);
    setGroundTruthFile(null);
    setCurrentStep(3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-6 pb-16">
      <div className="max-w-6xl mx-auto py-12 space-y-10">
        <header className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_top,_#9AE6B4_0,_transparent_50%)]" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                <Brain className="w-4 h-4" />
                Vertigo Agent Workbench
              </p>
              <h1 className="text-4xl font-extrabold text-slate-900 mt-4 tracking-tight">
                Build and verify clinical agent workflows
              </h1>
              <p className="text-slate-600 mt-3 max-w-2xl">
                Parse clinician spreadsheets locally, tune prompts, call the
                backend agent, and reconcile against real ground truth without
                Base44 dependencies.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Local parsing, no PHI leaves browser until agent call
              </div>
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-sky-500" />
                Future backend endpoints: `/agent/run` & `/agent/reconcile`
              </div>
            </div>
          </div>
        </header>

        <section className="bg-white border border-slate-100 rounded-3xl px-6 py-5 flex flex-col gap-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-semibold text-sm ${
                    currentStep >= step.id
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {step.label}
                  </p>
                  <p className="text-xs text-slate-500">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <AnimatePresence mode="wait">
          {!inputMode && (
            <motion.div
              key="mode-selector"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Choose how to ingest data
                  </h2>
                  <p className="text-slate-500">
                    Upload Excel/CSV straight from the browser or paste rows
                    manually.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={loadSampleData}
                  className="border-emerald-200 text-emerald-700"
                >
                  Load curated sample workbook
                </Button>
              </div>
              <InputSelector
                selectedMode={inputMode}
                onSelectMode={setInputMode}
              />
            </motion.div>
          )}

          {inputMode && !processedData && (
            <motion.div
              key="input-stage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Button
                variant="ghost"
                onClick={resetWorkflow}
                className="text-slate-500 hover:text-slate-900"
              >
                ← Choose another ingestion option
              </Button>

              {inputMode === "excel" && (
                <FileUploader
                  onFileSelect={handleFileSelect}
                  isProcessing={isProcessing}
                  uploadedFile={file}
                />
              )}

              {inputMode === "text" && (
                <TextInput
                  onSubmit={handleTextSubmit}
                  isProcessing={isProcessing}
                />
              )}

              {inputMode === "sample" && (
                <div className="bg-white rounded-2xl border border-emerald-100 p-6">
                  <p className="text-slate-600">
                    Sample dataset loaded. Scroll down to preview and continue
                    to the prompt tuning stage.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {processedData && (
            <motion.div
              key="processed-stage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <DataTable
                  data={processedData}
                  title="Parsed Patient Rows"
                  variant="processed"
                />
                <div className="space-y-6">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
                          Agent Prompt
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">
                          Customize the clinical instructions
                        </h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAgentPrompt(DEFAULT_SYSTEM_PROMPT)}
                        disabled={agentPrompt === DEFAULT_SYSTEM_PROMPT}
                      >
                        Reset
                      </Button>
                    </div>
                    <Textarea
                      value={agentPrompt}
                      onChange={(event) => setAgentPrompt(event.target.value)}
                      className="min-h-[220px] text-sm"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Range start
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={totalPatients || 1}
                          value={patientRangeStart}
                          onChange={(event) => {
                            const next = Math.floor(Number(event.target.value));
                            setPatientRangeStart(
                              Number.isFinite(next) ? next : patientRangeStart
                            );
                          }}
                          disabled={!totalPatients}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Range end
                        </label>
                        <Input
                          type="number"
                          min={patientRangeStart || 1}
                          max={totalPatients || 1}
                          value={patientRangeEnd}
                          onChange={(event) => {
                            const next = Math.floor(Number(event.target.value));
                            setPatientRangeEnd(
                              Number.isFinite(next) ? next : patientRangeEnd
                            );
                          }}
                          disabled={!totalPatients}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 mt-4">
                      <div className="text-xs text-slate-500 space-y-1">
                        <p>
                          Include structured schema instructions so the backend
                          agent can return tabular results.
                        </p>
                        {totalPatients > 0 && (
                          <p>
                            Sending patients {patientRangeStart} –{" "}
                            {patientRangeEnd} ({selectedPatientCount} selected;
                            max {MAX_PATIENTS_PER_RUN} processed per run).
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={handleRunAgent}
                        disabled={!canRunAgent || isRunningAgent}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {isRunningAgent
                          ? "Running agent..."
                          : "Run agent on parsed patients"}
                      </Button>
                      {rangeWarning && (
                        <div className="text-xs text-amber-600">
                          {rangeWarning}
                        </div>
                      )}
                      {agentError && (
                        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                          <AlertTriangle className="w-4 h-4" />
                          {agentError}
                        </div>
                      )}
                    </div>
                  </div>
                  <JsonPreview title="Payload preview" data={processedData} />
                </div>
              </div>

              {agentResults && agentResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold text-slate-900">
                        Agent output snapshot
                      </h3>
                      <p className="text-slate-500">
                        Direct response from `/agent/run` in a tabular friendly
                        format.
                      </p>
                    </div>
                    {agentRunMetadata && (
                      <div className="text-xs text-slate-500">
                        Run ID:{" "}
                        <span className="font-mono text-slate-700">
                          {agentRunMetadata.runId || "pending"}
                        </span>
                        <br />
                        Started:{" "}
                        {agentRunMetadata.createdAt
                          ? new Date(
                              agentRunMetadata.createdAt
                            ).toLocaleString()
                          : "pending"}
                      </div>
                    )}
                  </div>
                  <DataTable
                    data={agentResults}
                    title="Agent Predictions"
                    variant="processed"
                  />
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <GroundTruthUpload
                    onFileSelect={handleGroundTruthSelect}
                    groundTruthFile={groundTruthFile}
                    isProcessing={isProcessing}
                  />
                  <Button
                    variant="outline"
                    onClick={useSampleGroundTruth}
                    className="border-purple-200 text-purple-700"
                  >
                    Use curated ground truth sample
                  </Button>
                </div>
                <JsonPreview
                  title="Ground truth preview"
                  data={groundTruthData}
                />
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-2xl border border-slate-100 p-6">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Ready to reconcile?
                  </p>
                  <p className="text-xs text-slate-500">
                    Both agent predictions and ground truth must be loaded.
                  </p>
                </div>
                <Button
                  onClick={handleReconcile}
                  disabled={!canReconcile || isReconciling}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {isReconciling ? "Reconciling..." : "Run reconciliation"}
                </Button>
              </div>

              {reconciliationResults && (
                <div className="space-y-6">
                  <ReconciliationResults results={reconciliationResults} />
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={resetWorkflow}>
                      Start new workbook
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setReconciliationResults(null)}
                    >
                      Keep context, rerun reconciliation
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
