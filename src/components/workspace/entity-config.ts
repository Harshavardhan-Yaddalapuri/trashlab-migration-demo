/**
 * Config-driven entity screens. Each entity type declares its columns and
 * detail fields once; EntityListView/EntityDetailPanel render any config
 * without knowing which entity type they're showing. Adding a new entity
 * type (Sites, Containers, Routes, Tickets) is "write a config," not
 * "write a new screen."
 */

import type { EntityRecord } from "@/lib/api";

export interface EntityColumn {
  key: string;
  label: string;
  /** Falls back to `fields[key]` when omitted. */
  render?: (record: EntityRecord) => string;
}

export interface EntityConfig {
  entityType: string;
  label: string;
  singularLabel: string;
  columns: EntityColumn[];
  detailFields: EntityColumn[];
}

function field(key: string): (record: EntityRecord) => string {
  return (record) => record.fields[key] ?? "";
}

function formatCents(value: string | undefined): string {
  if (!value) return "";
  const cents = Number(value);
  if (Number.isNaN(cents)) return value;
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mappedField(key: string): (record: EntityRecord) => string {
  return (record) => {
    const value = record.mappedFields?.[key];
    return value === undefined || value === null ? "" : String(value);
  };
}

export const CUSTOMER_CONFIG: EntityConfig = {
  entityType: "customer",
  label: "Customers",
  singularLabel: "Customer",
  columns: [
    { key: "name", label: "Name", render: field("name") },
    { key: "phone", label: "Phone", render: field("phone") },
    { key: "address", label: "Address", render: field("address") },
    {
      key: "location",
      label: "City / State / Zip",
      render: (r) => [r.fields.city, r.fields.state, r.fields.zip].filter(Boolean).join(", "),
    },
  ],
  detailFields: [
    { key: "name", label: "Name", render: field("name") },
    { key: "phone", label: "Phone", render: field("phone") },
    { key: "address", label: "Address", render: field("address") },
    { key: "city", label: "City", render: field("city") },
    { key: "state", label: "State", render: field("state") },
    { key: "zip", label: "Zip", render: field("zip") },
  ],
};

export const AGREEMENT_CONFIG: EntityConfig = {
  entityType: "agreement",
  label: "Agreements",
  singularLabel: "Agreement",
  columns: [
    { key: "name", label: "Customer", render: field("name") },
    { key: "serviceCode", label: "Legacy Code", render: field("serviceCode") },
    {
      key: "mapped",
      label: "Mapped To",
      render: (r) => {
        const lob = mappedField("lineOfBusiness")(r);
        const size = mappedField("sizeYards")(r);
        return lob ? `${lob}${size ? ` (${size}yd)` : ""}` : "Not mapped";
      },
    },
    { key: "rateCents", label: "Rate", render: (r) => formatCents(r.fields.rateCents) },
    { key: "startDate", label: "Start Date", render: field("startDate") },
  ],
  detailFields: [
    { key: "name", label: "Customer", render: field("name") },
    { key: "serviceCode", label: "Legacy Code", render: field("serviceCode") },
    { key: "lineOfBusiness", label: "Line of Business", render: mappedField("lineOfBusiness") },
    { key: "sizeYards", label: "Size (yards)", render: mappedField("sizeYards") },
    { key: "frequency", label: "Frequency", render: mappedField("frequency") },
    { key: "rateCents", label: "Rate", render: (r) => formatCents(r.fields.rateCents) },
    { key: "startDate", label: "Start Date", render: field("startDate") },
  ],
};

export const ENTITY_CONFIGS: EntityConfig[] = [CUSTOMER_CONFIG, AGREEMENT_CONFIG];

/** Plain-language labels for exception types. Never show raw type codes to users. */
export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  entity_resolution: "Possible duplicate",
  missing_service_code: "No service code on file",
  low_mapping_confidence: "Uncertain service code mapping",
  pricing_conflict: "Conflicting pricing",
  orphan_container: "No site assigned",
  missing_customer_reference: "Not linked to a customer yet",
  missing_site_reference: "Not linked to a site yet",
  closed_but_unbilled: "Closed but not fully billed",
  unmatched_scale_ticket: "Not linked to a job",
  ungeocodable_site: "Address needs verification",
};

export function describeExceptionType(type: string): string {
  return EXCEPTION_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}
