import * as XLSX from "xlsx";

const SHEET_PRIORITY = ["real data", "test data"];

const toTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : value;

const normalizeKey = (key) =>
  typeof key === "string" ? key.replace(/\s+/g, " ").trim() : key;

const findPreferredSheetName = (sheetNames = []) => {
  if (!Array.isArray(sheetNames) || sheetNames.length === 0) return undefined;
  const normalized = sheetNames.map((name) => name?.toString() ?? "");
  for (const preferred of SHEET_PRIORITY) {
    const match = normalized.find(
      (candidate) => candidate.trim().toLowerCase() === preferred
    );
    if (match) return match;
  }
  return sheetNames[0];
};

const parseColumnOrientedSheet = (worksheet) => {
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  if (!matrix.length) return [];

  const patientCount =
    Math.max(...matrix.map((row) => (Array.isArray(row) ? row.length : 0)), 0) -
    1;

  if (!Number.isFinite(patientCount) || patientCount <= 0) {
    return [];
  }

  const patients = Array.from({ length: patientCount }, () => ({}));

  matrix.forEach((row) => {
    if (!Array.isArray(row) || row.length === 0) return;
    const rawLabel = normalizeKey(row[0]);
    if (!rawLabel) return;

    for (let columnIndex = 1; columnIndex <= patientCount; columnIndex += 1) {
      const value = row[columnIndex];
      if (value === undefined || value === null) continue;
      const normalizedValue = toTrimmedString(value);
      if (normalizedValue === "") continue;

      const patient = patients[columnIndex - 1];
      if (!patient) continue;

      if (patient[rawLabel]) {
        if (patient[rawLabel] === normalizedValue) continue;
        patient[rawLabel] = Array.isArray(patient[rawLabel])
          ? Array.from(new Set([...patient[rawLabel], normalizedValue]))
          : Array.from(new Set([patient[rawLabel], normalizedValue]));
      } else {
        patient[rawLabel] = normalizedValue;
      }
    }
  });

  return patients
    .map((patient, index) => {
      const flattened = {};
      Object.entries(patient).forEach(([key, value]) => {
        flattened[key] = Array.isArray(value) ? value.join(" | ") : value;
      });
      if (!flattened["Patient#"]) {
        flattened["Patient#"] = `Patient-${index + 1}`;
      }
      return flattened;
    })
    .filter((patient) => Object.keys(patient).length > 0);
};

const AGENT_FIELD_BLOCKLIST = [
  /^\d+$/,
  /true stroke/i,
  /^stroke risk/i,
  /^risk(score)?$/i,
  /^risk score$/i,
  /^risk_score$/i,
  /^clinical (trail|trial) risk estimate/i,
  /^clinical (trail|trial) soapnote diagnosis/i,
  /^final diagnosis/i,
  /^true stroke percent chance/i,
];

const shouldExcludeAgentField = (key = "") =>
  AGENT_FIELD_BLOCKLIST.some((pattern) => pattern.test(key.trim()));

const parseRowOrientedSheet = (worksheet) => {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
    blankrows: false,
  });

  if (!rows.length) return [];

  return rows.map((row) => {
    const normalizedRow = {};
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = normalizeKey(key);
      if (!normalizedKey) return;
      const normalizedValue = toTrimmedString(value);
      if (normalizedValue === "" || normalizedValue === undefined) return;
      normalizedRow[normalizedKey] = normalizedValue;
    });
    return normalizedRow;
  });
};

// Parses the preferred worksheet (column- or row-oriented) into JSON rows
export function parseSpreadsheet(file, options = {}) {
  // options preserved for backward compatibility (mode is handled downstream)
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = findPreferredSheetName(workbook.SheetNames || []);
        if (!sheetName) {
          resolve([]);
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          resolve([]);
          return;
        }

        const columnOriented = parseColumnOrientedSheet(worksheet);
        if (columnOriented.length) {
          resolve(columnOriented);
          return;
        }

        resolve(parseRowOrientedSheet(worksheet));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Unable to read the provided spreadsheet"));
    };

    reader.readAsArrayBuffer(file);
  });
}

export const numberLike = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(
    typeof value === "string" ? value.replace(/[^0-9.-]/g, "") : value
  );
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const truthyStrokeValue = (value) => {
  if (!value && value !== 0) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (/^yes$/i.test(normalized)) return true;
  if (/^no$/i.test(normalized)) return false;
  if (/stroke/i.test(normalized))
    return /non[- ]?stroke/i.test(normalized) ? false : true;
  return undefined;
};

const buildSymptoms = (row) => {
  const fields = [
    row["Combined Symptom"],
    row["Combined Symptoms"],
    row.Symptoms,
    row["Suden Onset Vertigo"],
    row["Sudden Onset Vertigo"],
    row["Positional Vertigo"],
    row["Dizziness that is reproducible with standing"],
  ];

  const cleaned = fields
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value && value.toLowerCase() !== "unknown");

  return cleaned.length ? cleaned.join("; ") : undefined;
};

export function normalizePatientRows(rows = [], options = {}) {
  // options: { mode: "agent" | "groundTruth" }
  return rows
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;

      const normalizedRow = {};
      Object.entries(row).forEach(([key, value]) => {
        const normalizedKey = normalizeKey(key);
        if (!normalizedKey) return;
        if (options.mode === "agent" && shouldExcludeAgentField(normalizedKey))
          return;
        const normalizedValue = Array.isArray(value)
          ? value
              .map((entry) => toTrimmedString(entry))
              .filter((entry) => entry !== "" && entry !== undefined)
              .join(" | ")
          : toTrimmedString(value);

        if (normalizedValue === "" || normalizedValue === undefined) return;
        normalizedRow[normalizedKey] = normalizedValue;
      });

      const patientIdSource =
        normalizedRow["Patient#"] ||
        normalizedRow.patient_id ||
        normalizedRow.PatientID ||
        normalizedRow["Patient ID"] ||
        normalizedRow["patientId"] ||
        `Patient-${index + 1}`;

      const patientId = String(
        patientIdSource || `Patient-${index + 1}`
      ).trim();

      normalizedRow.patient_id = patientId;
      normalizedRow.PatientID = patientId;
      normalizedRow["Patient#"] = normalizedRow["Patient#"] || patientId;
      normalizedRow.originalRowIndex = index;

      const riskScoreRaw =
        normalizedRow.RiskScore ||
        normalizedRow.risk_score ||
        normalizedRow["Stroke Risk"] ||
        normalizedRow.Risk ||
        normalizedRow["clinical trail risk estimate"] ||
        normalizedRow["clinical trial risk estimate"];

      const riskScore = numberLike(riskScoreRaw);
      if (typeof riskScore === "number") {
        normalizedRow.RiskScore = riskScore;
        normalizedRow.risk_score = riskScore;
      }

      const truthValue =
        truthyStrokeValue(normalizedRow.trueStroke) ??
        truthyStrokeValue(normalizedRow["True Stroke?"]) ??
        truthyStrokeValue(normalizedRow["True Stroke"]) ??
        truthyStrokeValue(normalizedRow.FinalDiagnosis) ??
        truthyStrokeValue(normalizedRow.Diagnosis);

      if (typeof truthValue === "boolean" && options.mode === "groundTruth") {
        normalizedRow.trueStroke = truthValue;
        if (!normalizedRow.FinalDiagnosis) {
          normalizedRow.FinalDiagnosis = truthValue ? "Stroke" : "Non-Stroke";
        }
      }

      if (!normalizedRow.Symptoms) {
        const symptomSummary = buildSymptoms(normalizedRow);
        if (symptomSummary) {
          normalizedRow.Symptoms = symptomSummary;
        }
      }

      if (options.mode === "groundTruth") {
        return {
          "Patient#": normalizedRow["Patient#"],
          "True Stroke?":
            normalizedRow["True Stroke?"] ?? normalizedRow["True Stroke"] ?? "",
          "Stroke Risk":
            normalizedRow["Stroke Risk"] ?? normalizedRow.RiskScore ?? "",
        };
      }

      return normalizedRow;
    })
    .filter(Boolean);
}
