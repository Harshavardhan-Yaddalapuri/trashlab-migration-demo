/**
 * Normalizer agent (LangGraph normalize node).
 *
 * Applies the T3 normalization rules to raw records: company names, phones
 * (E.164), dates (mixed formats, ambiguity flagged), container IDs, and money
 * (integer cents). Infers the entity type from the fields present. Emits
 * RecordNormalized / AmbiguityFlagged events per record.
 *
 * Rules are pure functions; the LLM is never asked to normalize.
 * Flagged values stay in the payload untouched, never silently coerced.
 */

import { centsFromString } from "@/lib/money";
import type { EntityType, NormalizedRecord, RawRecord } from "@/lib/types";
import { normalizeDate } from "@/pipeline/rules/date-normalizer";
import { normalizeContainerId } from "@/pipeline/rules/id-normalizer";
import { normalizeCompanyName } from "@/pipeline/rules/name-normalizer";
import { normalizePhone } from "@/pipeline/rules/phone-normalizer";
import type {
  AgentContext,
  NormalizeAgent,
  NormalizeResult,
  NormalizeEvent,
  NormalizeFlag,
} from "./contracts";

const CANONICAL_CONTAINER_PATTERN = /^RC-\d+$/;

/**
 * Infers the entity type from the fields that carry data. Deterministic and
 * conservative: a record with no recognizable shape is "unknown", never
 * guessed into a wrong bucket.
 */
export function inferEntityType(fields: Record<string, string>): EntityType {
  const has = (key: string): boolean => {
    const value = fields[key];
    return value !== undefined && value.trim() !== "";
  };

  if (has("grossTons") && has("date")) return "ticket";
  if (has("serviceCode") || has("rateCents") || (has("startDate") && has("status"))) {
    return "agreement";
  }
  // RoutePro's customer, container, and route rows share one column shape
  // (name,phone,address,city,state,zip,sizeYards,type,dayOfWeek), with
  // placeholder sizeYards/type/dayOfWeek values filled on every row kind.
  // Container and route rows are distinguishable by their generated name
  // prefix; check those first, or every customer row (which also carries
  // placeholder sizeYards/type) gets misclassified as a container.
  const name = fields["name"] ?? "";
  if (name.startsWith("Container ")) return "container";
  if (name.startsWith("Route ")) return "route";
  if (has("phone") && has("name")) return "customer";
  if (has("sizeYards") || has("type")) return "container";
  if (has("name") && has("address") && !has("serviceCode") && !has("dayOfWeek")) {
    return "site";
  }
  if (has("dayOfWeek") || (has("name") && has("siteIds"))) return "route";
  return "unknown";
}

export class DeterministicNormalizeAgent implements NormalizeAgent {
  async run(ctx: AgentContext, records: RawRecord[]): Promise<NormalizeResult> {
    const normalized: NormalizedRecord[] = [];
    const flagged: NormalizeFlag[] = [];
    const events: NormalizeEvent[] = [];

    for (const record of records) {
      const fields: Record<string, string> = { ...record.payload };
      const recordFlags: NormalizeFlag[] = [];

      // Company name
      const name = fields["name"];
      if (name !== undefined && name.trim() !== "") {
        fields["name"] = normalizeCompanyName(name);
      }

      // Phone -> E.164; never coerced when invalid
      const phone = fields["phone"];
      if (phone !== undefined && phone.trim() !== "") {
        const e164 = normalizePhone(phone);
        if (e164 !== null) {
          fields["phone"] = e164;
        } else {
          recordFlags.push({ rawRecordId: record.id, field: "phone", note: "not E.164" });
        }
      }

      // Dates: ambiguity and invalidity are flagged, never guessed
      for (const dateField of ["date", "startDate", "endDate", "signedDate"]) {
        const raw = fields[dateField];
        if (raw === undefined || raw.trim() === "") continue;
        const result = normalizeDate(raw);
        if (result.iso !== null) {
          fields[dateField] = result.iso;
        } else {
          recordFlags.push({
            rawRecordId: record.id,
            field: dateField,
            note: result.ambiguous ? (result.note ?? "ambiguous") : (result.note ?? "invalid date"),
          });
        }
      }

      // Container ID -> canonical RC-<digits>; unrecognized stays cleaned.
      // The bare "id" field is only treated as a container id when it looks
      // like one (RC-/BIN/CONTAINER prefix or pure digits), so customer,
      // site, agreement, route, and ticket ids are never mis-flagged.
      const CONTAINER_ISH = /^(?:RC[- ]?|BIN[- ]?|CONTAINER[- ]?)?\d{1,6}$/i;
      for (const idField of ["containerId", "id"]) {
        const raw = fields[idField];
        if (raw === undefined || raw.trim() === "") continue;
        if (idField === "id" && !CONTAINER_ISH.test(raw.trim())) continue;
        const canonical = normalizeContainerId(raw);
        fields[idField] = canonical;
        if (!CANONICAL_CONTAINER_PATTERN.test(canonical)) {
          recordFlags.push({ rawRecordId: record.id, field: idField, note: "unrecognized container id" });
        }
      }

      // Money -> integer cents; invalid stays raw and is flagged
      for (const moneyField of ["rateCents", "amount", "price"]) {
        const raw = fields[moneyField];
        if (raw === undefined || raw.trim() === "") continue;
        try {
          fields[moneyField] = String(centsFromString(raw));
        } catch {
          recordFlags.push({ rawRecordId: record.id, field: moneyField, note: "invalid money" });
        }
      }

      const entityType = inferEntityType(fields);

      const recordId = `n-${record.id}`;
      normalized.push({
        id: recordId,
        rawRecordId: record.id,
        entityType,
        fields,
        normalizedAt: ctx.now(),
      });

      events.push({
        type: "RecordNormalized",
        recordId,
        entityType,
      });

      for (const flag of recordFlags) {
        flagged.push({ rawRecordId: record.id, field: flag.field, note: flag.note });
        events.push({
          type: "AmbiguityFlagged",
          recordId,
          entityType,
          field: flag.field,
          note: flag.note,
        });
      }
    }

    return { normalized, flagged, events };
  }
}

export const normalizeAgent: NormalizeAgent = new DeterministicNormalizeAgent();
