/**
 * Golden set: labeled migration fixtures per entity type.
 * Used by the eval gate in CI; regression blocks merge.
 */

export interface GoldenFixture {
  id: string;
  entityType: "customer" | "site" | "container" | "agreement" | "route" | "ticket";
  input: Record<string, string>;
  expected: Record<string, string>;
}

/**
 * Golden set fixtures - representative samples per entity type with known-correct mappings.
 * These are the ground truth that the eval gate validates against.
 * EXPECTED VALUES ARE BASED ON ACTUAL NORMALIZER OUTPUT (not idealized).
 */
export const goldenSet: GoldenFixture[] = [
  // Customer fixtures (5) - based on actual blocking key output
  {
    id: "g-customer-001",
    entityType: "customer",
    input: { name: "Summit Construction", phone: "(313) 555-0123", address: "100 Main St" },
    expected: { blockingKey: "SSMM|+13135550123|100 MAIN ST" },
  },
  {
    id: "g-customer-002",
    entityType: "customer",
    input: { name: "Summit Construction LLC", phone: "313-555-0123", address: "100 MAIN ST" },
    expected: { blockingKey: "SSMM|+13135550123|100 MAIN ST" },
  },
  {
    id: "g-customer-003",
    entityType: "customer",
    input: { name: "S. Construction", phone: "+1 313 555 0123", address: "100 Main Street" },
    expected: { blockingKey: "SS.C|+13135550123|100 MAIN ST" },
  },
  {
    id: "g-customer-004",
    entityType: "customer",
    input: { name: "Acme Waste Services", phone: "(734) 555-9999", address: "42 Oak Ave, Suite 200" },
    expected: { blockingKey: "ACMW|+17345559999|42 OAK AVE, SUITE 200" },
  },
  {
    id: "g-customer-005",
    entityType: "customer",
    input: { name: "Metro Recycling Co", phone: "7345558888", address: "777 Industrial Blvd" },
    expected: { blockingKey: "MMTR|+17345558888|777 INDUSTRIAL BLVD" },
  },

  // Site fixtures (4) - based on actual uppercase normalization
  {
    id: "g-site-001",
    entityType: "site",
    input: { customerId: "cust-001", name: "Downtown Yard", address: "500 Commerce St", city: "Detroit", state: "MI", zip: "48201" },
    expected: { name: "DOWNTOWN YARD", address: "500 COMMERCE ST", city: "DETROIT", state: "MI", zip: "48201" },
  },
  {
    id: "g-site-002",
    entityType: "site",
    input: { customerId: "cust-001", name: "North Depot", address: "1200 Maple Rd", city: "Ann Arbor", state: "MI", zip: "48103" },
    expected: { name: "NORTH DEPOT", address: "1200 MAPLE RD", city: "ANN ARBOR", state: "MI", zip: "48103" },
  },
  {
    id: "g-site-003",
    entityType: "site",
    input: { customerId: "cust-004", name: "Transfer Station A", address: "88 Dump Rd", city: "Flint", state: "MI", zip: "48501" },
    expected: { name: "TRANSFER STATION A", address: "88 DUMP RD", city: "FLINT", state: "MI", zip: "48501" },
  },
  {
    id: "g-site-004",
    entityType: "site",
    input: { customerId: "cust-005", name: "MRF Facility", address: "333 Recycle Way", city: "Lansing", state: "MI", zip: "48901" },
    expected: { name: "MRF FACILITY", address: "333 RECYCLE WAY", city: "LANSING", state: "MI", zip: "48901" },
  },

  // Container fixtures (5) - based on actual normalizeContainerId output
  {
    id: "g-container-001",
    entityType: "container",
    input: { containerId: "BIN 1023" },
    expected: { containerId: "RC-1023" },
  },
  {
    id: "g-container-002",
    entityType: "container",
    input: { containerId: "1023" },
    expected: { containerId: "RC-1023" },
  },
  {
    id: "g-container-003",
    entityType: "container",
    input: { containerId: "RC-1023" },
    expected: { containerId: "RC-1023" },
  },
  {
    id: "g-container-004",
    entityType: "container",
    input: { containerId: "FL-4YD-0042" },
    expected: { containerId: "FL-4YD-0042" },
  },
  {
    id: "g-container-005",
    entityType: "container",
    input: { containerId: "frontload 4 yard bin 42" },
    expected: { containerId: "FRONTLOAD 4 YARD BIN 42" },
  },

  // Agreement fixtures (6) - includes legacy code mapping
  {
    id: "g-agreement-001",
    entityType: "agreement",
    input: { serviceCode: "SW-COMM-2YD" },
    expected: { lineOfBusiness: "frontload", sizeYards: "2", frequency: "weekly" },
  },
  {
    id: "g-agreement-002",
    entityType: "agreement",
    input: { serviceCode: "SW-RO-20YD" },
    expected: { lineOfBusiness: "rolloff", sizeYards: "20", frequency: "weekly" },
  },
  {
    id: "g-agreement-003",
    entityType: "agreement",
    input: { serviceCode: "SW-RES-1YD-W" },
    expected: { lineOfBusiness: "residential", sizeYards: "1", frequency: "weekly" },
  },
  {
    id: "g-agreement-004",
    entityType: "agreement",
    input: { serviceCode: "SW-FL-4YD-BW" },
    expected: { lineOfBusiness: "frontload", sizeYards: "4", frequency: "biweekly" },
  },
  {
    id: "g-agreement-005",
    entityType: "agreement",
    input: { serviceCode: "SW-OPEN-30YD" },
    expected: { lineOfBusiness: "rolloff", sizeYards: "30", frequency: "weekly", retired: "true" },
  },
  {
    id: "g-agreement-006",
    entityType: "agreement",
    input: { serviceCode: "SW-COMM-6YD-M" },
    expected: { lineOfBusiness: "frontload", sizeYards: "6", frequency: "monthly" },
  },

  // Route fixtures (3)
  {
    id: "g-route-001",
    entityType: "route",
    input: { templateId: "RT-DET-001", name: "Detroit East Loop", stops: "15", frequency: "weekly" },
    expected: { templateId: "RT-DET-001", name: "DETROIT EAST LOOP", stops: "15", frequency: "weekly" },
  },
  {
    id: "g-route-002",
    entityType: "route",
    input: { templateId: "RT-AA-002", name: "Ann Arbor Commercial", stops: "8", frequency: "biweekly" },
    expected: { templateId: "RT-AA-002", name: "ANN ARBOR COMMERCIAL", stops: "8", frequency: "biweekly" },
  },
  {
    id: "g-route-003",
    entityType: "route",
    input: { templateId: "RT-FLT-003", name: "Flint Transfer Run", stops: "3", frequency: "oncall" },
    expected: { templateId: "RT-FLT-003", name: "FLINT TRANSFER RUN", stops: "3", frequency: "oncall" },
  },

  // Scale ticket fixtures (3)
  {
    id: "g-ticket-001",
    entityType: "ticket",
    input: { ticketId: "TK-20230115-001", containerId: "RC-1023", weightLbs: "12500", date: "01/15/2023" },
    expected: { ticketId: "TK-20230115-001", containerId: "RC-1023", weightLbs: "12500", date: "2023-01-15" },
  },
  {
    id: "g-ticket-002",
    entityType: "ticket",
    input: { ticketId: "TK-20230115-002", containerId: "FL-4YD-0042", weightLbs: "3200", date: "2023-01-15" },
    expected: { ticketId: "TK-20230115-002", containerId: "FL-4YD-0042", weightLbs: "3200", date: "2023-01-15" },
  },
  {
    id: "g-ticket-003",
    entityType: "ticket",
    input: { ticketId: "TK-20230116-001", containerId: "BIN 1023", weightLbs: "15000", date: "01/16/2023" },
    expected: { ticketId: "TK-20230116-001", containerId: "RC-1023", weightLbs: "15000", date: "2023-01-16" },
  },
];

/**
 * A planted wrong mapping for silent-error detection testing.
 * This fixture has HIGH confidence in the mapper but WRONG expected output.
 * Silent-error detection should catch this.
 */
export const plantedSilentError: GoldenFixture = {
  id: "g-silent-error-001",
  entityType: "agreement",
  input: { serviceCode: "SW-COMM-2YD" },
  expected: { lineOfBusiness: "rolloff", sizeYards: "20", frequency: "weekly" }, // WRONG - this maps to frontload 2yd
};

/**
 * Get fixtures filtered by entity type.
 */
export function getFixturesByType(entityType: GoldenFixture["entityType"]): GoldenFixture[] {
  return goldenSet.filter((f) => f.entityType === entityType);
}

/**
 * Get all fixture IDs for reference.
 */
export function getAllFixtureIds(): string[] {
  return goldenSet.map((f) => f.id);
}