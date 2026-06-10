// Shared CSV helpers used by the records export functions.
//
// donation-utils.mjs ships its own recordsToCsv() that is hard-coded to the
// donation field list, so it cannot be reused for other record types. This
// module provides a generic equivalent that accepts an explicit field list,
// keeping the CSV escaping rules identical across every export.

export const escapeCsvValue = (value) => {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const recordsToCsv = (records, fields) => {
  const rows = records.map((record) =>
    fields.map((field) => escapeCsvValue(record?.[field])).join(",")
  );

  return [fields.join(","), ...rows].join("\n");
};
