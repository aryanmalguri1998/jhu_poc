import React, { useState } from 'react';
import { FileText, Table, Type } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function InputSelector({ onSelectMode, selectedMode }) {
  const modes = [
    { id: 'excel', label: 'Excel/CSV File', icon: Table, description: 'Upload .xlsx, .xls, or .csv file' },
    { id: 'text', label: 'Enter Text', icon: Type, description: 'Paste or type patient data' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {modes.map((mode) => (
        <motion.button
          key={mode.id}
          onClick={() => onSelectMode(mode.id)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`
            p-6 rounded-2xl border-2 transition-all duration-300 text-left
            ${selectedMode === mode.id 
              ? 'border-teal-500 bg-teal-50 shadow-lg' 
              : 'border-gray-200 bg-white hover:border-teal-300'
            }
          `}
        >
          <div className="flex items-start gap-4">
            <div className={`
              p-3 rounded-xl
              ${selectedMode === mode.id ? 'bg-teal-100' : 'bg-gray-100'}
            `}>
              <mode.icon className={`w-6 h-6 ${selectedMode === mode.id ? 'text-teal-600' : 'text-gray-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{mode.label}</h3>
              <p className="text-sm text-gray-500">{mode.description}</p>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}