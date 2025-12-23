import React, { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function RiskScoreComparison({ riskScores }) {
  if (!riskScores || riskScores.length === 0) return null;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">Patient #{data.patientId || data.index}</p>
          <p className="text-sm text-gray-600">Processed: {data.processedRisk}%</p>
          <p className="text-sm text-gray-600">Ground Truth: {data.groundTruthRisk}%</p>
          <p className="text-sm font-medium mt-1" style={{ 
            color: Math.abs(data.difference) > 10 ? '#ef4444' : '#10b981' 
          }}>
            Difference: {data.difference > 0 ? '+' : ''}{data.difference.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const avgDifference = riskScores.reduce((sum, item) => sum + Math.abs(item.difference), 0) / riskScores.length;
  const largeDiscrepancies = riskScores.filter(item => Math.abs(item.difference) > 10).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Activity className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <CardTitle>Risk Score Comparison</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Processed vs Ground Truth</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Avg Diff: {avgDifference.toFixed(1)}%
            </Badge>
            {largeDiscrepancies > 0 && (
              <Badge variant="destructive" className="text-xs">
                {largeDiscrepancies} Large Gaps
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Points near the diagonal line indicate good agreement. Points far from the line show significant discrepancies.
          </p>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              type="number" 
              dataKey="processedRisk" 
              name="Processed Risk" 
              unit="%" 
              domain={[0, 100]}
              stroke="#6b7280"
              label={{ value: 'Processed Risk Score (%)', position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              type="number" 
              dataKey="groundTruthRisk" 
              name="Ground Truth" 
              unit="%" 
              domain={[0, 100]}
              stroke="#6b7280"
              label={{ value: 'Ground Truth Risk Score (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            {/* Perfect agreement line */}
            <ReferenceLine 
              segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} 
              stroke="#94a3b8" 
              strokeDasharray="5 5"
              label={{ value: 'Perfect Agreement', position: 'insideTopRight', fill: '#64748b' }}
            />
            <Scatter 
              name="Risk Scores" 
              data={riskScores} 
              fill="#14b8a6"
              fillOpacity={0.6}
            >
              {riskScores.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={Math.abs(entry.difference) > 10 ? '#ef4444' : '#14b8a6'}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}