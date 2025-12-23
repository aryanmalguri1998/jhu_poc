import React, { useState } from 'react';
import { Copy, Check, Sparkles, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function PromptOutput({ prompt, isGenerating }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([prompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medical-data-prompt.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isGenerating) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-violet-100 to-purple-100 rounded-lg">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <h3 className="font-semibold text-gray-800">Generated Prompt</h3>
        </div>

        <div className="bg-gradient-to-br from-violet-50/50 to-purple-50/50 rounded-2xl border border-violet-100 p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full"
            />
            <p className="text-violet-600 font-medium">Analyzing medical data...</p>
            <p className="text-sm text-gray-500">Generating optimized prompt</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!prompt) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-100 to-purple-100 rounded-lg">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <h3 className="font-semibold text-gray-800">Generated Prompt</h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-gray-600 hover:text-gray-800 border-gray-200"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          
          <Button
            onClick={handleCopy}
            size="sm"
            className={`
              transition-all duration-300
              ${copied 
                ? 'bg-emerald-500 hover:bg-emerald-600' 
                : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700'
              }
            `}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-200 to-purple-200 rounded-2xl blur-xl opacity-30 group-hover:opacity-40 transition-opacity" />
        
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
          </div>
          
          <div className="p-6 max-h-[400px] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
              {prompt}
            </pre>
          </div>
        </div>
      </div>
    </motion.div>
  );
}