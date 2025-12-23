import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Play } from "lucide-react";

export default function ExperimentSetup({ onStart }) {
  const [environment, setEnvironment] = useState("clinical-trial");
  const [patientsText, setPatientsText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStart = async () => {
    if (!patientsText.trim()) return;

    setIsProcessing(true);
    try {
      const patients = parsePatientsText(patientsText);
      if (!patients.length) {
        throw new Error(
          'Could not detect any patient entries. Use blank lines to separate cases and include "[Actual: Stroke]" or "[Actual: Non-stroke]" markers.'
        );
      }

      onStart({
        environment,
        patients,
      });
    } catch (error) {
      console.error("Error parsing patients:", error);
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Configure Experiment
        </h2>
        <p className="text-gray-600">
          Set up your LLM diagnostic evaluation experiment
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment Setting</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={environment} onValueChange={setEnvironment}>
            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="clinical-trial" id="clinical-trial" />
              <Label htmlFor="clinical-trial" className="cursor-pointer flex-1">
                <div>
                  <p className="font-semibold">Clinical Trial</p>
                  <p className="text-sm text-gray-500">
                    All patients get MRI regardless of diagnosis. Full feedback
                    on all decisions.
                  </p>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="routine-care" id="routine-care" />
              <Label htmlFor="routine-care" className="cursor-pointer flex-1">
                <div>
                  <p className="font-semibold">Routine Care</p>
                  <p className="text-sm text-gray-500">
                    Only admitted patients get MRI. Missed strokes go
                    undetected.
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patient Cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>
              Enter patient case descriptions (one per line or paragraph)
            </Label>
            <Textarea
              value={patientsText}
              onChange={(e) => setPatientsText(e.target.value)}
              placeholder="Example:&#10;[Patient 1] History: A 60 year old White Female presents with dizziness reproduced with standing. They have a past medical history of: a 15 year history of type 2 diabetes, no history of smoking, no history of prior stroke, no known atrial fibrillation, and a BMI of 27. On bedside exam they have no ataxia on finger-nose-finger, no direction changing nystagmus in lateral gaze, no skew deviation, and a negative head impulse test. [Actual: Non-stroke]&#10;&#10;[Patient 2] History: A 68 year old Black Male presents with sudden onset vertigo..."
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleStart}
              disabled={!patientsText.trim() || isProcessing}
              size="lg"
              className="bg-[#002D72] hover:bg-[#001a44] text-white shadow-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              {isProcessing ? "Processing..." : "Start Experiment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const parsePatientsText = (input) => {
  const blocks = input
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, idx) => {
    const actualMatch = block.match(/\[Actual:\s*(.*?)\]/i);
    const actualDiagnosis = actualMatch
      ? normalizeDiagnosis(actualMatch[1])
      : "Non-stroke";
    const presentation = actualMatch
      ? block.replace(actualMatch[0], "").trim()
      : block;

    return {
      patientNumber: idx + 1,
      presentation,
      actualDiagnosis,
    };
  });
};

const normalizeDiagnosis = (value = "") => {
  const lower = value.toLowerCase();
  if (lower.includes("stroke") && !lower.includes("non")) return "Stroke";
  return "Non-stroke";
};
