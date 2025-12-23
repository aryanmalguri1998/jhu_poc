import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TextInput({ onSubmit, isProcessing }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter Patient Data
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste patient data here (tab-separated or comma-separated values)..."
            className="min-h-[300px] font-mono text-sm"
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Enter patient data with fields separated by tabs or commas. Each row should represent one patient.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || isProcessing}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Send className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processing...' : 'Process Data'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}