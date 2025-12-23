import React, { useRef } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function GroundTruthUpload({
  onFileSelect,
  groundTruthFile,
  isProcessing,
}) {
  const fileInputRef = useRef(null);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const triggerFileDialog = () => {
    if (!isProcessing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-dashed border-purple-200 p-6"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-purple-100 rounded-xl">
          <Upload className="w-6 h-6 text-purple-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-2">
            Upload Ground Truth File
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload the real clinical patient data file to reconcile against the
            processed data
          </p>

          {!groundTruthFile ? (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                disabled={isProcessing}
              />
              <Button
                type="button"
                variant="outline"
                onClick={triggerFileDialog}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                disabled={isProcessing}
              >
                <Upload className="w-4 h-4 mr-2" />
                Select Ground Truth File
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-800">
                  {groundTruthFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  {(groundTruthFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
