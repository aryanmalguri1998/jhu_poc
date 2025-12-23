import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ChevronDown, ChevronUp, MousePointerClick } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PatientDetailModal from '../PatientDetailModal';

export default function PatientLevelAnalysis({ patientMetrics, detailedPatientData }) {
  const [showAll, setShowAll] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  if (!patientMetrics || patientMetrics.length === 0) return null;

  const displayData = showAll ? patientMetrics : patientMetrics.slice(0, 20);

  const getColorByAccuracy = (accuracy) => {
    if (accuracy >= 90) return '#10b981';
    if (accuracy >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const handlePatientClick = (data) => {
    if (data && detailedPatientData) {
      const patientDetail = detailedPatientData.find(p => p.patientId === data.patientId);
      if (patientDetail) {
        setSelectedPatient(patientDetail);
      }
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{data.patientId}</p>
          <p className="text-sm text-gray-600">Fields Matched: {data.matchedFields}/{data.totalFields}</p>
          <p className="text-sm text-gray-600">Accuracy: {data.accuracy.toFixed(1)}%</p>
          {data.criticalMismatch && (
            <Badge variant="destructive" className="mt-1">Critical Mismatch</Badge>
          )}
          <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
            <MousePointerClick className="w-3 h-3" />
            Click for details
          </p>
        </div>
      );
    }
    return null;
  };

  const avgAccuracy = patientMetrics.reduce((sum, p) => sum + p.accuracy, 0) / patientMetrics.length;
  const criticalCount = patientMetrics.filter(p => p.criticalMismatch).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Patient-Level Accuracy</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Click on any bar to view detailed patient information
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Avg: {avgAccuracy.toFixed(1)}%
            </Badge>
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} Critical
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart 
            data={displayData} 
            layout="horizontal"
            onClick={(e) => {
              if (e && e.activePayload && e.activePayload[0]) {
                handlePatientClick(e.activePayload[0].payload);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" domain={[0, 100]} stroke="#6b7280" />
            <YAxis 
              type="category" 
              dataKey="patientId" 
              stroke="#6b7280" 
              width={80}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="accuracy" 
              name="Accuracy" 
              radius={[0, 4, 4, 0]}
              cursor="pointer"
            >
              {displayData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getColorByAccuracy(entry.accuracy)}
                  className="hover:opacity-80 transition-opacity"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {patientMetrics.length > 20 && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-sm"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show All {patientMetrics.length} Patients
                </>
              )}
            </Button>
          </div>
        )}

        {/* Patient Detail Modal */}
        <PatientDetailModal
          isOpen={!!selectedPatient}
          onClose={() => setSelectedPatient(null)}
          patientData={selectedPatient}
        />
      </CardContent>
    </Card>
  );
}