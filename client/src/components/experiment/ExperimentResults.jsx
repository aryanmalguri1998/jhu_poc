import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import PatientDetailModal from "./PatientDetailModal";

export default function ExperimentResults({ results }) {
  const [showAllPatients, setShowAllPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const { environment, patientResults, finalMetrics } = results;

  const accuracy = (
    (finalMetrics.correctDiagnoses /
      (finalMetrics.correctDiagnoses + finalMetrics.incorrectDiagnoses)) *
    100
  ).toFixed(1);
  const safetyRate =
    finalMetrics.strokesDetected + finalMetrics.strokesMissed > 0
      ? (
          (finalMetrics.strokesDetected /
            (finalMetrics.strokesDetected + finalMetrics.strokesMissed)) *
          100
        ).toFixed(1)
      : 0;

  // Generate accuracy over time data
  const accuracyOverTime = patientResults.map((result, idx) => {
    const correctSoFar = patientResults
      .slice(0, idx + 1)
      .filter((r) => r.correct).length;
    const totalSoFar = idx + 1;
    return {
      patient: idx + 1,
      accuracy: ((correctSoFar / totalSoFar) * 100).toFixed(1),
    };
  });

  const displayResults = showAllPatients
    ? patientResults
    : patientResults.slice(0, 20);

  const handleDownload = () => {
    const data = JSON.stringify(results, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment-${environment}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="border-[#002D72] border-l-4 shadow-md">
        <CardHeader className="bg-gradient-to-r from-[#002D72] to-[#003d72] text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Experiment Complete</CardTitle>
              <p className="text-sm text-[#68ACE5] mt-2">
                Environment:{" "}
                <Badge
                  variant="outline"
                  className="bg-white/10 text-white border-white/30"
                >
                  {environment}
                </Badge>
              </p>
            </div>
            <Button
              onClick={handleDownload}
              className="bg-white text-[#002D72] hover:bg-gray-100"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-green-600 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1 uppercase tracking-wide">
              Strokes Detected
            </p>
            <p className="text-3xl font-bold text-[#002D72]">
              {finalMetrics.strokesDetected}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Safety Rate: {safetyRate}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-red-600 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1 uppercase tracking-wide">
              Strokes Missed
            </p>
            <p className="text-3xl font-bold text-[#002D72]">
              {finalMetrics.strokesMissed}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-[#68ACE5] shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1 uppercase tracking-wide">
              Diagnostic Accuracy
            </p>
            <p className="text-3xl font-bold text-[#002D72]">{accuracy}%</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-[#002D72] shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1 uppercase tracking-wide">
              Total Patients
            </p>
            <p className="text-3xl font-bold text-[#002D72]">
              {patientResults.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Accuracy Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={accuracyOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="patient"
                label={{
                  value: "Patient Number",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                label={{
                  value: "Accuracy (%)",
                  angle: -90,
                  position: "insideLeft",
                }}
                domain={[0, 100]}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Patient Results */}
      <Card>
        <CardHeader>
          <CardTitle>Patient-by-Patient Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayResults.map((result, idx) => {
              const numericRisk =
                typeof result.llmRiskScore === "number"
                  ? result.llmRiskScore
                  : null;
              const probabilityLabel =
                result.finalProbability ||
                (numericRisk !== null ? `${numericRisk.toFixed(1)}%` : "N/A");
              const badgeVariant =
                numericRisk !== null && numericRisk > 15
                  ? "destructive"
                  : "secondary";

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedPatient(result)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    result.correct
                      ? "bg-green-50 border-green-200 hover:bg-green-100"
                      : "bg-red-50 border-red-200 hover:bg-red-100"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Patient {result.patientNumber}
                      </Badge>
                      {result.correct ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <Badge variant={badgeVariant}>
                      Probability: {probabilityLabel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">LLM Diagnosis:</p>
                      <p className="font-semibold">{result.llmDiagnosis}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Actual Diagnosis:</p>
                      <p className="font-semibold">{result.actualDiagnosis}</p>
                    </div>
                  </div>
                  {result.riskCalculation && (
                    <p className="text-xs text-gray-600 mt-3 max-h-14 overflow-hidden whitespace-pre-wrap">
                      {result.riskCalculation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {patientResults.length > 20 && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setShowAllPatients(!showAllPatients)}
              >
                {showAllPatients ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Show All {patientResults.length} Patients
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Detail Modal */}
      <PatientDetailModal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        patientResult={selectedPatient}
      />
    </div>
  );
}
