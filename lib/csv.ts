/** Downloads rows as a CSV file Excel opens correctly (semicolons, UTF-8 BOM). Client only. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const content = [header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");
  const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
