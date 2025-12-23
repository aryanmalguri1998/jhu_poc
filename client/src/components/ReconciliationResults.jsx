import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MatchRateChart from "./charts/MatchRateChart";
import ErrorDistributionChart from "./charts/ErrorDistributionChart";
import RiskScoreComparison from "./charts/RiskScoreComparison";
import AccuracyOverTime from "./charts/AccuracyOverTime";
import PatientLevelAnalysis from "./charts/PatientLevelAnalysis";
import PatientDetailModal from "./PatientDetailModal";
import http from "@/api/http";

export default function ReconciliationResults({ results }) {
  const [selectedMismatchPatient, setSelectedMismatchPatient] = useState(null);
  const [outcomeDrafts, setOutcomeDrafts] = useState({});
  const [sendingOutcome, setSendingOutcome] = useState({});
  const [sentOutcome, setSentOutcome] = useState({});

  if (!results) return null;

  const {
    matches,
    mismatches,
    summary,
    feedback,
    errorTypes,
    riskScores,
    timeSeriesData,
    patientMetrics,
    detailedPatientData,
    outcomeEvents = [],
    outcomeSummary,
    conversationId,
  } = results;

  const outcomeKeys = useMemo(
    () =>
      outcomeEvents.map(
        (event, idx) => `${event.patientId || event.scenario || "event"}-${idx}`
      ),
    [outcomeEvents]
  );

  useEffect(() => {
    const nextDrafts = {};
    outcomeEvents.forEach((event, idx) => {
      const key = `${event.patientId || event.scenario || "event"}-${idx}`;
      nextDrafts[key] = event.promptText || "";
    });
    setOutcomeDrafts(nextDrafts);
    setSendingOutcome({});
    setSentOutcome({});
  }, [outcomeEvents]);

  const handleOutcomeChange = (key, value) => {
    setOutcomeDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const handleSendOutcome = async (key) => {
    const promptText = outcomeDrafts[key];
    if (!promptText || promptText.trim().length < 5 || !conversationId) return;

    setSendingOutcome((prev) => ({ ...prev, [key]: true }));
    try {
      await http.post("/agent/outcome", { promptText, conversationId });
      setSentOutcome((prev) => ({ ...prev, [key]: true }));
    } catch (error) {
      console.error("Unable to send outcome prompt", error);
    } finally {
      setSendingOutcome((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-800">
                Matches
              </CardTitle>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              {summary.matchCount}
            </div>
            <p className="text-sm text-green-700 mt-1">
              {summary.matchPercentage}% accuracy
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-red-800">
                Mismatches
              </CardTitle>
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">
              {summary.mismatchCount}
            </div>
            <p className="text-sm text-red-700 mt-1">
              {summary.mismatchPercentage}% error rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-amber-800">
                Total Records
              </CardTitle>
              <BarChart3 className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900">
              {summary.totalRecords}
            </div>
            <p className="text-sm text-amber-700 mt-1">Reconciled patients</p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Visualizations */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
        <CardHeader>
          <CardTitle className="text-xl">
            Interactive Data Visualizations
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Explore detailed metrics and patterns from the reconciliation
            analysis
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="errors">Error Types</TabsTrigger>
              <TabsTrigger value="risk">Risk Scores</TabsTrigger>
              <TabsTrigger value="trend">Trend</TabsTrigger>
              <TabsTrigger value="patients">Patients</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <MatchRateChart data={summary} />
              {errorTypes && errorTypes.length > 0 && (
                <ErrorDistributionChart errorTypes={errorTypes} />
              )}
            </TabsContent>

            <TabsContent value="errors">
              {errorTypes && errorTypes.length > 0 ? (
                <ErrorDistributionChart errorTypes={errorTypes} />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No error type data available
                </div>
              )}
            </TabsContent>

            <TabsContent value="risk">
              {riskScores && riskScores.length > 0 ? (
                <RiskScoreComparison riskScores={riskScores} />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No risk score comparison data available
                </div>
              )}
            </TabsContent>

            <TabsContent value="trend">
              {timeSeriesData && timeSeriesData.length > 0 ? (
                <AccuracyOverTime timeSeriesData={timeSeriesData} />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No time series data available
                </div>
              )}
            </TabsContent>

            <TabsContent value="patients">
              {patientMetrics && patientMetrics.length > 0 ? (
                <PatientLevelAnalysis
                  patientMetrics={patientMetrics}
                  detailedPatientData={detailedPatientData}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No patient-level data available
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* AI Feedback */}
      {feedback && (
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-violet-600" />
              </div>
              <CardTitle>AI-Generated Feedback</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{feedback}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outcome Prompts (editable before dispatch) */}
      {outcomeEvents && outcomeEvents.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Outcome Prompts (Review & Edit)</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Prompts are generated per patient; edit as needed before
                  sending to the model.
                  {!conversationId && (
                    <span className="block text-xs text-amber-600 mt-1">
                      Conversation link unavailable, manual resend is disabled.
                    </span>
                  )}
                </p>
              </div>
              {outcomeSummary && (
                <div className="text-xs text-gray-600 text-right">
                  <div>Strokes Detected: {outcomeSummary.strokesDetected}</div>
                  <div>Strokes Missed: {outcomeSummary.strokesMissed}</div>
                  <div>Correct Dx: {outcomeSummary.correctDiagnoses}</div>
                  <div>Incorrect Dx: {outcomeSummary.incorrectDiagnoses}</div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {outcomeEvents.map((event, idx) => {
              const key = outcomeKeys[idx];
              return (
                <div
                  key={key}
                  className="border rounded-lg p-4 bg-slate-50 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Badge variant="secondary">{event.promptTitle}</Badge>
                      {event.patientId && (
                        <Badge variant="outline">
                          Patient {event.patientId}
                        </Badge>
                      )}
                      {event.scenario && (
                        <Badge variant="outline" className="text-xs">
                          {event.scenario}
                        </Badge>
                      )}
                    </div>
                    {sentOutcome[key] ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        Sent
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-orange-600 border-orange-200"
                      >
                        Pending send
                      </Badge>
                    )}
                  </div>

                  <Textarea
                    value={outcomeDrafts[key] || ""}
                    onChange={(e) => handleOutcomeChange(key, e.target.value)}
                    className="min-h-[140px]"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        handleOutcomeChange(key, event.promptText || "")
                      }
                      disabled={sendingOutcome[key]}
                    >
                      Reset to generated
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSendOutcome(key)}
                      disabled={sendingOutcome[key] || !conversationId}
                    >
                      {sendingOutcome[key]
                        ? "Sending..."
                        : conversationId
                        ? "Send prompt"
                        : "Unavailable"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Mismatches Details */}
      {mismatches && mismatches.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <CardTitle>Discrepancies Found</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {mismatches.length} records with differences - Click for
                  patient context
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {mismatches.slice(0, 20).map((mismatch, idx) => {
                const patientDetail = detailedPatientData?.find(
                  (p) =>
                    p.patientId === `Patient ${mismatch.recordIndex || idx + 1}`
                );

                return (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.01 }}
                    className="p-4 border border-red-100 rounded-lg bg-red-50/50 hover:bg-red-100/50 transition-all cursor-pointer"
                    onClick={() =>
                      patientDetail && setSelectedMismatchPatient(patientDetail)
                    }
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-red-700 border-red-300"
                        >
                          Patient {mismatch.recordIndex || idx + 1}
                        </Badge>
                        {mismatch.field && (
                          <Badge variant="secondary" className="text-xs">
                            {mismatch.field}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-blue-600 hover:text-blue-700"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">Processed Data:</p>
                        <p className="font-medium text-gray-800">
                          {mismatch.processed}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Ground Truth:</p>
                        <p className="font-medium text-gray-800">
                          {mismatch.groundTruth}
                        </p>
                      </div>
                    </div>

                    {/* Show snippet of clinical context if available */}
                    {patientDetail?.clinicalSummary && (
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {patientDetail.clinicalSummary.primarySymptoms && (
                            <span className="text-gray-600">
                              <strong>Symptoms:</strong>{" "}
                              {patientDetail.clinicalSummary.primarySymptoms}
                            </span>
                          )}
                          {patientDetail.clinicalSummary.diagnosis && (
                            <span className="text-gray-600">
                              <strong>Diagnosis:</strong>{" "}
                              {patientDetail.clinicalSummary.diagnosis}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
              {mismatches.length > 20 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  + {mismatches.length - 20} more discrepancies
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patient Detail Modal for Mismatches */}
      <PatientDetailModal
        isOpen={!!selectedMismatchPatient}
        onClose={() => setSelectedMismatchPatient(null)}
        patientData={selectedMismatchPatient}
      />
    </motion.div>
  );
}
