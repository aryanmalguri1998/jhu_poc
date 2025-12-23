import React from "react";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Users } from "lucide-react";

export default function DataTable({ data, title, variant = "default" }) {
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0] || {});
  const displayData = data.slice(0, 50); // Show first 50 rows

  const formatCellValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return { text: "", isStructured: false };
    }

    if (typeof value === "object") {
      try {
        return {
          text: JSON.stringify(value, null, 2),
          isStructured: true,
        };
      } catch (error) {
        return { text: String(value), isStructured: false };
      }
    }

    return { text: String(value), isStructured: false };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              variant === "ground-truth" ? "bg-purple-100" : "bg-indigo-100"
            }`}
          >
            {variant === "ground-truth" ? (
              <Users className="w-5 h-5 text-purple-600" />
            ) : (
              <Database className="w-5 h-5 text-indigo-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500">
              {displayData.length} of {data.length} records
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          {headers.length} columns
        </Badge>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
              <TableRow>
                {headers.map((header, idx) => (
                  <TableHead
                    key={idx}
                    className="whitespace-nowrap font-semibold"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, rowIdx) => (
                <TableRow key={rowIdx} className="hover:bg-gray-50">
                  {headers.map((header, cellIdx) => (
                    <TableCell key={cellIdx} className="text-sm align-top">
                      {(() => {
                        const { text, isStructured } = formatCellValue(
                          row[header]
                        );
                        if (!text) {
                          return (
                            <span className="text-gray-300 italic">-</span>
                          );
                        }
                        if (isStructured) {
                          return (
                            <pre className="text-xs whitespace-pre-wrap bg-gray-50 rounded p-2 border border-gray-100">
                              {text}
                            </pre>
                          );
                        }
                        return (
                          <span className="whitespace-nowrap">{text}</span>
                        );
                      })()}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data.length > 50 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Showing first 50 of {data.length} records
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
