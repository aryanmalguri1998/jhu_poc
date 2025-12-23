import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pause, Play, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ExperimentProgress({ config, currentIndex, metrics, isPaused, onPause }) {
  const totalPatients = config.patients.length;
  const progress = ((currentIndex + 1) / totalPatients) * 100;
  const accuracy = metrics.correctDiagnoses + metrics.incorrectDiagnoses > 0
    ? (metrics.correctDiagnoses / (metrics.correctDiagnoses + metrics.incorrectDiagnoses) * 100).toFixed(1)
    : 0;
  const safetyRate = metrics.strokesDetected + metrics.strokesMissed > 0
    ? (metrics.strokesDetected / (metrics.strokesDetected + metrics.strokesMissed) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      <Card className="border-[#002D72] border-l-4 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#002D72] rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Experiment in Progress</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Environment: <Badge variant="outline">{config.environment}</Badge>
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onPause}>
              {isPaused ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Patient {currentIndex + 1} of {totalPatients}</span>
              <span className="font-semibold">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 mb-1">Strokes Detected</p>
              <p className="text-3xl font-bold text-green-600">{metrics.strokesDetected}</p>
              <p className="text-xs text-gray-500 mt-1">Safety: {safetyRate}%</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 mb-1">Strokes Missed</p>
              <p className="text-3xl font-bold text-red-600">{metrics.strokesMissed}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 mb-1">Correct Diagnoses</p>
              <p className="text-3xl font-bold text-blue-600">{metrics.correctDiagnoses}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 mb-1">Overall Accuracy</p>
              <p className="text-3xl font-bold text-indigo-600">{accuracy}%</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}