import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  Activity,
  FileText,
  Calculator,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PatientDetailModal({ isOpen, onClose, patientResult }) {
  if (!patientResult) return null;

  const {
    patientNumber,
    patientData,
    llmDiagnosis,
    llmRiskScore,
    actualDiagnosis,
    correct,
    fullResponse,
    riskCalculation,
    finalProbability,
    soapNote,
  } = patientResult;

  // Parse the response to extract sections
  const extractSections = (response) => {
    const sections = {
      riskCalculation: "",
      soapNote: "",
      fullThought: response,
    };

    // Try to extract risk calculation
    const riskCalcMatch = response.match(
      /(?:risk calculation|calculating risk|stroke probability)[\s\S]*?(?=soap|subjective|$)/i
    );
    if (riskCalcMatch) {
      sections.riskCalculation = riskCalcMatch[0].trim();
    }

    // Try to extract SOAP note
    const soapMatch = response.match(
      /(?:soap|subjective)[\s\S]*?(?=diagnosis:|$)/i
    );
    if (soapMatch) {
      sections.soapNote = soapMatch[0].trim();
    }

    return sections;
  };

  const sections = extractSections(fullResponse);
  const structuredRisk = riskCalculation || sections.riskCalculation;
  const structuredSoapNote = soapNote;
  const probabilityDisplay =
    finalProbability ||
    (typeof llmRiskScore === "number" ? `${llmRiskScore.toFixed(1)}%` : null);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl text-[#002D72]">
              Patient {patientNumber} - Detailed Analysis
            </DialogTitle>
            <div className="flex items-center gap-2">
              {correct ? (
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Correct Diagnosis
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 border-red-300">
                  <XCircle className="w-3 h-3 mr-1" />
                  Incorrect Diagnosis
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <div className="space-y-4">
            {/* Diagnosis Comparison */}
            <Card className="border-l-4 border-[#002D72]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Diagnosis Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">LLM Diagnosis</p>
                    <p className="font-semibold text-[#002D72]">
                      {llmDiagnosis}
                    </p>
                    {probabilityDisplay && (
                      <p className="text-sm text-gray-600 mt-1">
                        Stroke Probability: {probabilityDisplay}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      Actual Diagnosis (Ground Truth)
                    </p>
                    <p className="font-semibold text-[#002D72]">
                      {actualDiagnosis}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patient Presentation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Patient Presentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {patientData.presentation}
                </p>
              </CardContent>
            </Card>

            {/* Risk Calculation Steps */}
            {structuredRisk && (
              <Card className="border-l-4 border-[#68ACE5]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-[#68ACE5]" />
                    Risk Calculation Process
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {structuredRisk}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SOAP Note */}
            {(structuredSoapNote || sections.soapNote) && (
              <Card className="border-l-4 border-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    Mini-SOAP Note
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {structuredSoapNote ? (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 space-y-3">
                      {[
                        {
                          label: "Subjective",
                          value: structuredSoapNote.subjective,
                        },
                        {
                          label: "Objective",
                          value: structuredSoapNote.objective,
                        },
                        {
                          label: "Assessment & Plan",
                          value: structuredSoapNote.assessment_and_plan,
                        },
                        {
                          label: "Justification",
                          value: structuredSoapNote.justification,
                        },
                      ].map((section) => (
                        <div key={section.label}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
                            {section.label}
                          </p>
                          <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">
                            {section.value || "Not provided."}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {sections.soapNote}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Full LLM Response */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Complete LLM Thought Process
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {fullResponse}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
