// RFC 4180 CSV with two guards: every field is quoted when it needs to be,
// and a cell that a spreadsheet would read as a formula (=, +, -, @, tab,
// carriage return at the start) is prefixed with a quote character.

export type CsvValue = string | number | boolean | null | undefined;

export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}
