import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileUploader({ onFileSelect, isProcessing, uploadedFile }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const removeFile = () => {
    onFileSelect(null);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!uploadedFile ? (
          <motion.div
            key="upload-zone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative flex flex-col items-center justify-center w-full h-64 
                border-2 border-dashed rounded-2xl cursor-pointer
                transition-all duration-300 ease-out
                ${isDragging 
                  ? 'border-teal-500 bg-teal-50/50 scale-[1.02]' 
                  : 'border-gray-200 bg-gradient-to-b from-gray-50/50 to-white hover:border-teal-300 hover:bg-teal-50/30'
                }
              `}
            >
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
              />
              
              <motion.div
                animate={{ y: isDragging ? -5 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center"
              >
                <div className={`
                  p-4 rounded-2xl mb-4 transition-all duration-300
                  ${isDragging ? 'bg-teal-100' : 'bg-gray-100'}
                `}>
                  <Upload className={`w-8 h-8 transition-colors duration-300 ${isDragging ? 'text-teal-600' : 'text-gray-400'}`} />
                </div>
                
                <p className="text-lg font-medium text-gray-700 mb-1">
                  {isDragging ? 'Drop your file here' : 'Drop your Excel file here'}
                </p>
                <p className="text-sm text-gray-400">
                  or <span className="text-teal-600 font-medium hover:text-teal-700">browse</span> to upload
                </p>
                <p className="text-xs text-gray-300 mt-3">
                  Supports .xlsx, .xls, .csv files
                </p>
              </motion.div>
            </label>
          </motion.div>
        ) : (
          <motion.div
            key="file-info"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between p-5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <FileSpreadsheet className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">{uploadedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isProcessing ? (
                <div className="flex items-center gap-2 text-teal-600">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full"
                  />
                  <span className="text-sm font-medium">Processing...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Ready</span>
                </div>
              )}
              
              <button
                onClick={removeFile}
                className="p-2 hover:bg-white/80 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}