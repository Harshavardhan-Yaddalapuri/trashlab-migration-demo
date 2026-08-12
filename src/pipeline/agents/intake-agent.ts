/**
 * Intake agent (LangGraph ingest node).
 *
 * Parses the four simulated legacy sources (RoutePro CSV, QuickBooks export,
 * transfer-station spreadsheet, paper-era export), detects each file's format
 * by its declared kind, reports malformed rows (never silently drops), and
 * stores raw records untouched. Emits SourceParsed / RowQuarantined events.
 */

import { fnv1a } from "@/data/generate";
import type { RawRecord, SourceFile } from "@/lib/types";
import type { AgentContext, IntakeAgent, IntakeResult } from "./contracts";
import { parseSourceContent, type ParsedSourceContent } from "./intake-formats";

function rawRecordId(sourceFileId: string, row: number): string {
  return `${sourceFileId}:${row}`;
}

function recordHash(sourceFileId: string, row: number, line: string): string {
  return fnv1a(`${sourceFileId}:${row}:${line}`);
}

export class DeterministicIntakeAgent implements IntakeAgent {
  async run(ctx: AgentContext, files: SourceFile[]): Promise<IntakeResult> {
    const rawRecords: RawRecord[] = [];
    const parseErrors: IntakeResult["parseErrors"] = [];

    for (const file of files) {
      if (file.content === undefined || file.content === "") {
        parseErrors.push({
          sourceFileId: file.id,
          row: 0,
          message: "source file has no content to parse",
        });
        continue;
      }

      const parsed: ParsedSourceContent = parseSourceContent(file.kind, file.content);

      for (const row of parsed.rows) {
        if (row.error !== undefined) {
          parseErrors.push({
            sourceFileId: file.id,
            row: row.row,
            message: row.error,
          });
          continue;
        }
        rawRecords.push({
          id: rawRecordId(file.id, row.row),
          sourceFileId: file.id,
          sourceRow: row.row,
          payload: row.values,
          rawHash: recordHash(file.id, row.row, JSON.stringify(row.values)),
        });
      }
    }

    return { sourceFiles: files, rawRecords, parseErrors };
  }
}

export const intakeAgent: IntakeAgent = new DeterministicIntakeAgent();
