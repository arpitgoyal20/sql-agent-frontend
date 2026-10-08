// CSV export (RFC 4180): fields with commas, quotes or line breaks are quoted; quotes doubled.

import type { CellValue } from '../api/types';

export function csvField(value: CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header row plus one line per row, joined with CRLF as the RFC specifies. */
export function toCsv(columns: string[], rows: CellValue[][]): string {
  return [columns, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n');
}

/** Tab-separated text for pasting into a spreadsheet; tabs/newlines in values become spaces. */
export function toTsv(columns: string[], rows: CellValue[][]): string {
  const field = (v: CellValue | undefined) =>
    v === null || v === undefined ? '' : String(v).replace(/[\t\r\n]+/g, ' ');
  return [columns, ...rows].map((row) => row.map(field).join('\t')).join('\n');
}
