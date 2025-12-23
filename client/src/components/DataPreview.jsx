import React from 'react';
import { Table, Database } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DataPreview({ data }) {
  if (!data || data.length === 0) {
    return null;
  }

  const headers = Object.keys(data[0] || {});
  const displayData = data.slice(0, 10); // Show first 10 rows

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="w-full"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Database className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Data Preview</h3>
          <p className="text-sm text-gray-500">
            Showing {displayData.length} of {data.length} records
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                {headers.map((header, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayData.map((row, rowIdx) => (
                <motion.tr
                  key={rowIdx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: rowIdx * 0.03 }}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  {headers.map((header, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap max-w-[200px] truncate"
                    >
                      {row[header] !== null && row[header] !== undefined 
                        ? String(row[header]) 
                        : <span className="text-gray-300 italic">empty</span>
                      }
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {data.length > 10 && (
          <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              + {data.length - 10} more records
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}