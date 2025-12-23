import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  User, Activity, AlertCircle, CheckCircle, XCircle, 
  Heart, Stethoscope, Thermometer, TrendingUp, Calendar,
  FileText, AlertTriangle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PatientDetailModal({ isOpen, onClose, patientData }) {
  if (!patientData) return null;

  const { 
    patientId, 
    processedData, 
    groundTruthData, 
    matchedFields,
    mismatchedFields,
    accuracy,
    criticalMismatch,
    clinicalSummary 
  } = patientData;

  const renderFieldComparison = (field, processedValue, groundTruthValue, isMatch) => (
    <div key={field} className={`p-3 rounded-lg border ${
      isMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <span className="font-semibold text-sm text-gray-700">{field}</span>
        {isMatch ? (
          <CheckCircle className="w-4 h-4 text-green-600" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500 mb-1">Processed:</p>
          <p className="font-medium text-gray-800">{processedValue || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Ground Truth:</p>
          <p className="font-medium text-gray-800">{groundTruthValue || '-'}</p>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                Patient {patientId}
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-2">
                Detailed clinical record comparison
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge 
                variant={accuracy >= 90 ? 'default' : accuracy >= 70 ? 'warning' : 'destructive'}
                className="text-sm"
              >
                {accuracy.toFixed(1)}% Match
              </Badge>
              {criticalMismatch && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Critical Mismatch
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Clinical Summary Cards */}
          {clinicalSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {clinicalSummary.primarySymptoms && (
                <Card className="border-purple-200 bg-purple-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-purple-600" />
                      Primary Symptoms
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-gray-800">
                      {clinicalSummary.primarySymptoms}
                    </p>
                  </CardContent>
                </Card>
              )}

              {clinicalSummary.diagnosis && (
                <Card className="border-indigo-200 bg-indigo-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Diagnosis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-gray-800">
                      {clinicalSummary.diagnosis}
                    </p>
                  </CardContent>
                </Card>
              )}

              {clinicalSummary.riskScore !== undefined && (
                <Card className="border-teal-200 bg-teal-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-teal-600" />
                      Risk Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-teal-700">
                      {clinicalSummary.riskScore}%
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Key Risk Factors */}
          {clinicalSummary?.riskFactors && clinicalSummary.riskFactors.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Heart className="w-4 h-4 text-amber-600" />
                  Key Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {clinicalSummary.riskFactors.map((factor, idx) => (
                    <Badge key={idx} variant="outline" className="bg-white">
                      {factor}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Demographics */}
          {clinicalSummary?.demographics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-600" />
                  Patient Demographics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {clinicalSummary.demographics.age && (
                    <div>
                      <p className="text-gray-500">Age</p>
                      <p className="font-medium">{clinicalSummary.demographics.age}</p>
                    </div>
                  )}
                  {clinicalSummary.demographics.sex && (
                    <div>
                      <p className="text-gray-500">Sex</p>
                      <p className="font-medium">{clinicalSummary.demographics.sex}</p>
                    </div>
                  )}
                  {clinicalSummary.demographics.race && (
                    <div>
                      <p className="text-gray-500">Race</p>
                      <p className="font-medium">{clinicalSummary.demographics.race}</p>
                    </div>
                  )}
                  {clinicalSummary.demographics.bmi && (
                    <div>
                      <p className="text-gray-500">BMI</p>
                      <p className="font-medium">{clinicalSummary.demographics.bmi}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Field-by-Field Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detailed Field Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="mismatches" className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="mismatches">
                    Mismatches ({mismatchedFields?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="matches">
                    Matches ({matchedFields?.length || 0})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="mismatches" className="space-y-3 mt-4">
                  {mismatchedFields && mismatchedFields.length > 0 ? (
                    mismatchedFields.map(field => 
                      renderFieldComparison(
                        field.name, 
                        field.processedValue, 
                        field.groundTruthValue, 
                        false
                      )
                    )
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No mismatches found
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="matches" className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
                  {matchedFields && matchedFields.length > 0 ? (
                    matchedFields.map(field => 
                      renderFieldComparison(
                        field.name, 
                        field.value, 
                        field.value, 
                        true
                      )
                    )
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No matches found
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Clinical Context */}
          {clinicalSummary?.clinicalContext && (
            <Card className="border-violet-200 bg-violet-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-violet-600" />
                  Clinical Context & Implications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {clinicalSummary.clinicalContext}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}