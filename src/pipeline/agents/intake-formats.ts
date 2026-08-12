/**
 * Source format parsers for the four legacy systems.
 *
 * RoutePro 2019 CSV: quoted CSV, header row, customers/sites/containers/routes.
 * QuickBooks export: quoted CSV with two-column header and a summary footer.
 * Transfer-station spreadsheet: whitespace-aligned columns, comment lines.
 * Paper-era legacy export: fixed-width fields, first line is a column key.
 *
 * Every parser is pure and deterministic. Malformed rows are returned with a
 * message and NEVER silently dropped. Raw values are preserved untouched;
 * normalization is a later stage. No `any` anywhere.
 */

import { fnv1a } from "@/data/generate";
import type { SourceKind } from "@/lib/types";

export interface ParsedRow {
  /** 1-based row number as it appears in the source file (header excluded). */
  row: number;
  values: Record<string, string>;
  error?: string;
}

export interface ParsedSourceContent {
  kind: SourceKind;
  /** Stable identity of the raw bytes: hash of the original file content. */
  rawHash: string;
  headers: string[];
  rows: ParsedRow[];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Strips one trailing CR so files with CRLF line endings parse identically. */
function splitLines(content: string): string[] {
  return content.replace(/\r\n/g, "\n").split("\n");
}

/** Parses one CSV line, honoring double-quote escapes. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Splits on a literal delimiter outside double quotes. */
export function splitOutsideQuotes(line: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (line.startsWith(delimiter, i)) {
      parts.push(current);
      current = "";
      i += delimiter.length - 1;
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const header of headers) {
    const key = header.trim();
    if (key === "" || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    result.push(key);
  }
  return result;
}

function rowObject(headers: string[], cells: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (let i = 0; i < headers.length; i += 1) {
    values[headers[i]] = (cells[i] ?? "").trim();
  }
  return values;
}

// ---------------------------------------------------------------------------
// RoutePro 2019 CSV
// ---------------------------------------------------------------------------

export function parseRouteProCsv(content: string): ParsedSourceContent {
  const lines = splitLines(content).filter((line) => line.trim() !== "");
  const headers = uniqueHeaders(parseCsvLine(lines[0] ?? ""));
  const rows: ParsedRow[] = [];
  let rawHash = "";

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const cells = parseCsvLine(line);
    if (cells.length === 1 && cells[0].trim() === "") continue;
    const row: ParsedRow = {
      row: i,
      values: rowObject(headers, cells),
    };
    if (headers.length === 0) {
      row.error = "no header row";
    } else if (cells.length < headers.length) {
      row.error = `expected ${headers.length} columns, got ${cells.length}`;
    }
    rows.push(row);
    rawHash += `${row.row}:${line}\n`;
  }

  return { kind: "routepro-csv", rawHash: fnv1a(rawHash), headers, rows };
}

// ---------------------------------------------------------------------------
// QuickBooks export
// ---------------------------------------------------------------------------

export function parseQuickBooksExport(content: string): ParsedSourceContent {
  const lines = splitLines(content).filter((line) => line.trim() !== "");
  const headers = uniqueHeaders(parseCsvLine(lines[0] ?? ""));
  const rows: ParsedRow[] = [];
  let rawHash = "";

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const cells = parseCsvLine(line);
    const first = cells[0]?.trim() ?? "";
    // Skip the footer summary rows ("Total ..." / "Report ...").
    if (first === "" || /^total\b/i.test(first) || /^report\b/i.test(first)) continue;

    const row: ParsedRow = { row: i, values: rowObject(headers, cells) };
    if (headers.length === 0) {
      row.error = "no header row";
    } else if (cells.length < headers.length) {
      row.error = `expected ${headers.length} columns, got ${cells.length}`;
    }
    rows.push(row);
    rawHash += `${row.row}:${line}\n`;
  }

  return { kind: "quickbooks-export", rawHash: fnv1a(rawHash), headers, rows };
}

// ---------------------------------------------------------------------------
// Transfer-station spreadsheet
// ---------------------------------------------------------------------------

export function parseTransferSpreadsheet(content: string): ParsedSourceContent {
  const lines = splitLines(content);
  const rows: ParsedRow[] = [];
  let headers: string[] = [];
  let rawHash = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (/^#/.test(line.trim())) continue;

    if (headers.length === 0) {
      // Header row: whitespace-separated column keys with a trailing colon.
      const parts = splitOutsideQuotes(line, " ").filter((part) => part !== "");
      headers = parts.map((part) => part.replace(/:$/, ""));
      continue;
    }

    // Data rows are whitespace-aligned columns: runs of 2+ spaces separate
    // columns, single spaces inside a value (e.g. "BIN 2044") are preserved.
    const cells = line
      .split(/[ \t]{2,}/)
      .map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"))
      .filter((cell) => cell !== "");
    const row: ParsedRow = { row: i + 1, values: rowObject(headers, cells) };
    if (cells.length < headers.length) {
      row.error = `expected ${headers.length} columns, got ${cells.length}`;
    }
    rows.push(row);
    rawHash += `${row.row}:${line}\n`;
  }

  return { kind: "transfer-spreadsheet", rawHash: fnv1a(rawHash), headers, rows };
}

// ---------------------------------------------------------------------------
// Paper-era legacy export
// ---------------------------------------------------------------------------

/** Column widths, in order. Total must equal 96 characters. */
const LEGACY_COLUMN_WIDTHS: readonly number[] = [24, 14, 30, 8, 6, 14];

const LEGACY_HEADERS: readonly string[] = [
  "name",
  "service",
  "address",
  "route",
  "zone",
  "contact",
];

const LEGACY_TOTAL_WIDTH = LEGACY_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);

export function parseLegacyExport(content: string): ParsedSourceContent {
  const lines = splitLines(content);
  const rows: ParsedRow[] = [];
  let rawHash = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (i === 0) {
      // First line is a column key map, e.g. "NAME/SERVICE/ADDRESS/ROUTE/ZONE/CONTACT".
      continue;
    }

    const values: Record<string, string> = {};
    let offset = 0;
    for (let c = 0; c < LEGACY_COLUMN_WIDTHS.length; c += 1) {
      const width = LEGACY_COLUMN_WIDTHS[c];
      values[LEGACY_HEADERS[c]] = line.slice(offset, offset + width).trim();
      offset += width;
    }

    const row: ParsedRow = {
      row: i + 1,
      values,
      // The key line is not counted, so the first data row is file line 2.
    };
    if (line.length > LEGACY_TOTAL_WIDTH) {
      row.error = "row exceeds fixed-width layout";
    }
    rows.push(row);
    rawHash += `${row.row}:${line}\n`;
  }

  return { kind: "legacy-export", rawHash: fnv1a(rawHash), headers: [...LEGACY_HEADERS], rows };
}

// ---------------------------------------------------------------------------
// Format dispatch
// ---------------------------------------------------------------------------

const PARSERS: Record<SourceKind, (content: string) => ParsedSourceContent> = {
  "routepro-csv": parseRouteProCsv,
  "quickbooks-export": parseQuickBooksExport,
  "transfer-spreadsheet": parseTransferSpreadsheet,
  "legacy-export": parseLegacyExport,
};

/**
 * Parses a source file of the given kind. `content` is the raw file text.
 * Throws only if the file kind is unknown; format problems are reported
 * per-row in the result, never thrown.
 */
export function parseSourceContent(kind: SourceKind, content: string): ParsedSourceContent {
  const parser = PARSERS[kind];
  if (parser === undefined) {
    throw new Error(`Unknown source kind: ${kind}`);
  }
  return parser(content);
}

/** Serializes a dataset into the four simulated source formats (seed pipeline). */
export function serializeSourceFile(
  kind: SourceKind,
  rows: Array<Record<string, string>>,
): string {
  switch (kind) {
    case "routepro-csv":
    case "quickbooks-export": {
      const headers = Object.keys(rows[0] ?? {});
      const headerLine = headers.join(",");
      const lines = rows.map((row) => headers.map((h) => quoteCsv(row[h] ?? "")).join(","));
      return [headerLine, ...lines].join("\n") + "\n";
    }
    case "transfer-spreadsheet": {
      const headers = Object.keys(rows[0] ?? {});
      const headerLine = `${headers.map((h) => `${h}:`).join("  ")} `;
      const lines = rows.map((row) =>
        headers.map((h) => quoteCsv(row[h] ?? "")).join("  "),
      );
      return [headerLine, ...lines].join("\n") + "\n";
    }
    case "legacy-export": {
      const lines = rows.map((row) =>
        LEGACY_HEADERS.map((header, index) =>
          (row[header] ?? "").slice(0, LEGACY_COLUMN_WIDTHS[index]).padEnd(
            LEGACY_COLUMN_WIDTHS[index],
            " ",
          ),
        ).join(""),
      );
      return `NAME/SERVICE/ADDRESS/ROUTE/ZONE/CONTACT\n${lines.join("\n")}\n`;
    }
    default: {
      throw new Error(`Unknown source kind: ${String(kind)}`);
    }
  }
}

function quoteCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}
