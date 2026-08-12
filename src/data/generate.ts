/**
 * Deterministic seeded dataset generator for the TrashLab migration demo.
 *
 * Generates exactly 150,000 legacy records (45k customers, 35k sites, 40k
 * containers, 18k agreements, 7k routes, 5k scale tickets) with deliberate,
 * reproducible data-quality defects ("dirt"):
 *   - duplicate customer clusters (name/phone/address variants)
 *   - mixed date formats, including ambiguous 2-digit years
 *   - inconsistent container IDs (RC-1023 / 1023 / BIN 1023)
 *   - legacy service codes (SW-COMM-2YD) plus unmappable codes
 *   - conflicting pricing (same container+site, two rates)
 *   - orphan containers, closed-but-unbilled agreements,
 *     unmatched scale tickets, un-geocodable sites
 *
 * Same seed => byte-identical data every run. Pure functions only; no
 * Math.random, no I/O. Runs in-browser and in Node.
 */

import { config } from "@/lib/config";
import type { SourceKind } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  source: SourceKind;
  /** Set when this customer belongs to a duplicate cluster. */
  clusterId: string | null;
  /** True for duplicate variants; the base customer is the cluster anchor. */
  isVariant: boolean;
}

export interface SiteRecord {
  id: string;
  customerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  /** False = un-geocodable address (PO box, rural route, none on file). */
  geocodable: boolean;
  source: SourceKind;
}

export interface ContainerRecord {
  /** Dirty legacy id, e.g. "RC-1023", "1023", "BIN 1023". */
  id: string;
  /** Canonical id, e.g. "RC-1023". */
  canonicalId: string;
  /** Owning site; null = orphan container. */
  siteId: string | null;
  sizeYards: number;
  type: "rolloff" | "frontload";
  source: SourceKind;
}

export interface AgreementRecord {
  id: string;
  customerId: string;
  siteId: string;
  /** Dirty container id as it appears in the legacy system. */
  containerId: string;
  /** Legacy service code, e.g. "SW-COMM-2YD". */
  serviceCode: string;
  /** Rate in integer cents. Never float. */
  rateCents: number;
  /** Dirty date string (mixed formats). */
  startDate: string;
  endDate: string | null;
  status: "active" | "closed";
  /** false = closed-but-unbilled defect. */
  billed: boolean;
  source: SourceKind;
}

export interface RouteRecord {
  id: string;
  name: string;
  dayOfWeek: string;
  siteIds: string[];
  source: SourceKind;
}

export interface TicketRecord {
  id: string;
  /** Dirty date string (mixed formats). */
  date: string;
  /** Dirty container id; null = unmatched ticket. */
  containerId: string | null;
  agreementId: string | null;
  grossTons: number;
  source: SourceKind;
}

export interface GeneratedDataset {
  customers: CustomerRecord[];
  sites: SiteRecord[];
  containers: ContainerRecord[];
  agreements: AgreementRecord[];
  routes: RouteRecord[];
  tickets: TicketRecord[];
  total: number;
}

// ---------------------------------------------------------------------------
// Seeded RNG
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function chance(rng: () => number, probability: number): boolean {
  return rng() < probability;
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)];
}

function pad(value: number, width: number): string {
  return value.toString().padStart(width, "0");
}

// ---------------------------------------------------------------------------
// Name / address / phone pools
// ---------------------------------------------------------------------------

const NAME_PREFIXES = [
  "Summit", "Apex", "Blue", "Cedar", "Delta", "Eagle", "First", "Golden",
  "Iron", "Juniper", "Keystone", "Lakeside", "Midwest", "North", "Oak",
  "Pioneer", "Quality", "Red", "Silver", "Twin", "United", "Valley", "West",
  "Zephyr", "Cornerstone", "Heritage", "Liberty", "Magnolia", "Riverside",
] as const;

const NAME_MIDDLES = [
  "Construction", "Waste", "Disposal", "Hauling", "Demolition", "Excavating",
  "Landscaping", "Removal", "Services", "Sanitation", "Recycling",
  "Contracting", "Builders", "Development", "Maintenance", "Transport",
] as const;

const NAME_SUFFIXES = ["", "", "", " LLC", " Inc", " Corp", " Co", " Ltd"] as const;

const STREET_NAMES = [
  "Main", "Oak", "Maple", "Cedar", "Washington", "Lincoln", "Jefferson",
  "Adams", "Madison", "Monroe", "Jackson", "Grant", "Franklin", "Harrison",
  "Michigan", "Grand River", "Woodward", "Cass", "Trumbull", "Joy", "Warren",
  "Greenfield", "Telegraph", "Orchard Lake", "Haggerty", "Middlebelt", "Ford",
  "Cherry Hill", "Plymouth", "Van Buren",
] as const;

const STREET_SUFFIXES = ["St", "Ave", "Rd", "Blvd", "Dr", "Ln", "Ct", "Way", "Pkwy"] as const;

const CITIES = [
  "Detroit", "Dearborn", "Livonia", "Troy", "Southfield", "Warren",
  "Sterling Heights", "Royal Oak", "Farmington Hills", "Novi", "Canton",
  "Westland", "Taylor", "Allen Park", "Pontiac", "Ann Arbor", "Ypsilanti",
  "Flint", "Saginaw", "Lansing",
] as const;

const STATES = ["MI", "MI", "MI", "MI", "MI", "MI", "MI", "OH", "IN", "IL"] as const;

const AREA_CODES = ["313", "248", "586", "734", "810", "947"] as const;

const YARDS = ["Springfield East", "Springfield West", "Springfield North", "Springfield South"] as const;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const UNMAPPABLE_CODES = ["NOPE-1", "SW-XX-99YD", "LEGACY-CODE", "SW-COMM-XX", "OLD-SVC-7"] as const;

const CUSTOMER_SOURCES: readonly SourceKind[] = ["routepro-csv", "quickbooks-export", "legacy-export"];
const SITE_SOURCES: readonly SourceKind[] = ["routepro-csv", "legacy-export"];
const CONTAINER_SOURCES: readonly SourceKind[] = ["routepro-csv", "transfer-spreadsheet", "legacy-export"];
const AGREEMENT_SOURCES: readonly SourceKind[] = ["quickbooks-export", "routepro-csv"];
const ROUTE_SOURCES: readonly SourceKind[] = ["routepro-csv"];
const TICKET_SOURCES: readonly SourceKind[] = ["transfer-spreadsheet", "legacy-export"];

// ---------------------------------------------------------------------------
// Value builders
// ---------------------------------------------------------------------------

function makeCompanyName(rng: () => number): string {
  const prefix = pick(rng, NAME_PREFIXES);
  const middle = pick(rng, NAME_MIDDLES);
  const suffix = pick(rng, NAME_SUFFIXES);
  return `${prefix} ${middle}${suffix}`;
}

function makePhoneDigits(rng: () => number): string {
  const area = pick(rng, AREA_CODES);
  const line = 100 + int(rng, 0, 99);
  return `${area}555${pad(line, 4)}`;
}

function formatPhone(rng: () => number, digits: string): string {
  const r = rng();
  if (r < 0.3) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (r < 0.6) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (r < 0.8) return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return digits;
}

function makePhone(rng: () => number): string {
  return formatPhone(rng, makePhoneDigits(rng));
}

function makeAddress(rng: () => number): string {
  const number = int(rng, 1, 9999);
  const street = pick(rng, STREET_NAMES);
  const suffix = pick(rng, STREET_SUFFIXES);
  return `${number} ${street} ${suffix}`;
}

function makeUngeocodableAddress(rng: () => number): string {
  const r = rng();
  if (r < 0.4) return `PO Box ${int(rng, 1, 9999)}`;
  if (r < 0.7) return `RR ${int(rng, 1, 9)} Box ${int(rng, 1, 999)}`;
  return "No Address on File";
}

function makeZip(rng: () => number): string {
  return `${int(rng, 48000, 49999)}`;
}

function makeDirtyDate(rng: () => number): string {
  const year = 2019 + int(rng, 0, 5);
  const month = 1 + int(rng, 0, 11);
  const day = 1 + int(rng, 0, 27);
  const r = rng();
  if (r < 0.35) return `${pad(month, 2)}/${pad(day, 2)}/${year}`;
  if (r < 0.6) return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
  if (r < 0.8) return `${pad(day, 2)}-${MONTH_ABBR[month - 1]}-${String(year).slice(2)}`;
  return `${pad(month, 2)}/${pad(day, 2)}/${String(year).slice(2)}`;
}

function makeDirtyContainerId(rng: () => number, num: number): string {
  const r = rng();
  if (r < 0.4) return `RC-${num}`;
  if (r < 0.6) return `${num}`;
  if (r < 0.75) return `BIN ${num}`;
  if (r < 0.85) return `RC ${num}`;
  if (r < 0.95) return `CONTAINER ${num}`;
  return `rc-${num}`;
}

function makeServiceCode(rng: () => number, type: "rolloff" | "frontload", sizeYards: number): string {
  if (chance(rng, 0.08)) return pick(rng, ["SW-RES-1-W", "SW-RES-1-BW", "SW-RES-1-M"]);
  if (type === "rolloff") {
    return pick(rng, [`SW-RO-${sizeYards}YD`, `SW-ROLLOFF-${sizeYards}YD`, `SW-RO-${sizeYards}`]);
  }
  return pick(rng, [`SW-COMM-${sizeYards}YD`, `SW-FL-${sizeYards}YD`, `SW-COMM-${sizeYards}`]);
}

function rolloffBaseRate(sizeYards: number): number {
  switch (sizeYards) {
    case 10:
      return 30_000;
    case 20:
      return 40_000;
    case 30:
      return 50_000;
    case 40:
      return 60_000;
    default:
      return 40_000;
  }
}

function frontloadBaseRate(sizeYards: number): number {
  switch (sizeYards) {
    case 2:
      return 9_000;
    case 4:
      return 12_000;
    case 6:
      return 15_000;
    case 8:
      return 18_000;
    default:
      return 12_000;
  }
}

function makeRate(rng: () => number, sizeYards: number, type: "rolloff" | "frontload"): number {
  const base = type === "rolloff" ? rolloffBaseRate(sizeYards) : frontloadBaseRate(sizeYards);
  return base + int(rng, -5000, 5000);
}

// ---------------------------------------------------------------------------
// Entity generators
// ---------------------------------------------------------------------------

function makeCustomer(
  rng: () => number,
  index: number,
  clusterId: string | null,
  isVariant: boolean,
): CustomerRecord {
  return {
    id: `C-${pad(index + 1, 5)}`,
    name: makeCompanyName(rng),
    phone: makePhone(rng),
    address: makeAddress(rng),
    city: pick(rng, CITIES),
    state: pick(rng, STATES),
    zip: makeZip(rng),
    source: pick(rng, CUSTOMER_SOURCES),
    clusterId,
    isVariant,
  };
}

function variantName(rng: () => number, name: string): string {
  const r = rng();
  if (r < 0.4) {
    if (/\b(LLC|INC|CORP|CO|LTD)\b\.?/i.test(name)) {
      return name.replace(/\b(LLC|INC|CORP|CO|LTD)\b\.?/i, pick(rng, ["LLC", "Inc", "Corp", "Co."]));
    }
    return `${name} ${pick(rng, ["LLC", "Inc", "Corp", "Co."])}`;
  }
  if (r < 0.7) {
    const parts = name.split(" ");
    if (parts.length > 1) return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
    return name;
  }
  if (r < 0.9) {
    return name.replace(/\b(LLC|INC|CORP|CO|LTD)\b\.?/gi, "").replace(/\s+/g, " ").trim();
  }
  return name.toLowerCase();
}

function variantPhone(rng: () => number, phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return formatPhone(rng, digits);
}

function variantAddress(rng: () => number, address: string): string {
  const r = rng();
  if (r < 0.4) {
    return address
      .replace(/\bST\b/g, "Street")
      .replace(/\bAVE\b/g, "Avenue")
      .replace(/\bRD\b/g, "Road")
      .replace(/\bBLVD\b/g, "Boulevard")
      .replace(/\bDR\b/g, "Drive");
  }
  if (r < 0.7) {
    return address
      .replace(/\bStreet\b/g, "St")
      .replace(/\bAvenue\b/g, "Ave")
      .replace(/\bRoad\b/g, "Rd")
      .replace(/\bBoulevard\b/g, "Blvd")
      .replace(/\bDrive\b/g, "Dr");
  }
  if (r < 0.9) return address.toLowerCase();
  return address.replace(/\s+/g, "  ");
}

function makeCustomerVariant(
  rng: () => number,
  base: CustomerRecord,
  index: number,
  clusterId: string,
): CustomerRecord {
  return {
    ...base,
    id: `C-${pad(index + 1, 5)}`,
    name: variantName(rng, base.name),
    phone: variantPhone(rng, base.phone),
    address: variantAddress(rng, base.address),
    clusterId,
    isVariant: true,
  };
}

function variantCount(rng: () => number): number {
  if (chance(rng, 0.5)) return 1;
  if (chance(rng, 0.6)) return 2;
  return 3;
}

function generateCustomers(rng: () => number, count: number, clusterCount: number): CustomerRecord[] {
  const customers: CustomerRecord[] = [];
  for (let i = 0; i < clusterCount; i += 1) {
    const clusterId = `CL-${pad(i + 1, 4)}`;
    const base = makeCustomer(rng, customers.length, clusterId, false);
    customers.push(base);
    const variants = variantCount(rng);
    for (let v = 0; v < variants; v += 1) {
      customers.push(makeCustomerVariant(rng, base, customers.length, clusterId));
    }
  }
  while (customers.length < count) {
    customers.push(makeCustomer(rng, customers.length, null, false));
  }
  return customers;
}

function generateSites(rng: () => number, count: number, customers: CustomerRecord[]): SiteRecord[] {
  const sites: SiteRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const customer = pick(rng, customers);
    const ungeocodable = chance(rng, config.demo.dirt.ungeocodableSiteRate);
    const address = ungeocodable ? makeUngeocodableAddress(rng) : makeAddress(rng);
    sites.push({
      id: `S-${pad(i + 1, 5)}`,
      customerId: customer.id,
      name: `${customer.name} - Site ${int(rng, 1, 4)}`,
      address,
      city: ungeocodable ? "" : pick(rng, CITIES),
      state: ungeocodable ? "" : pick(rng, STATES),
      zip: ungeocodable ? "" : makeZip(rng),
      geocodable: !ungeocodable,
      source: pick(rng, SITE_SOURCES),
    });
  }
  return sites;
}

function generateContainers(rng: () => number, count: number, sites: SiteRecord[]): ContainerRecord[] {
  const containers: ContainerRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const isRolloff = chance(rng, 0.55);
    const sizeYards = isRolloff ? pick(rng, [10, 20, 30, 40]) : pick(rng, [2, 4, 6, 8]);
    const num = 1000 + int(rng, 0, 98_999);
    const orphan = chance(rng, config.demo.dirt.orphanContainerRate);
    const site = orphan ? null : pick(rng, sites);
    containers.push({
      id: makeDirtyContainerId(rng, num),
      canonicalId: `RC-${num}`,
      siteId: site?.id ?? null,
      sizeYards,
      type: isRolloff ? "rolloff" : "frontload",
      source: pick(rng, CONTAINER_SOURCES),
    });
  }
  return containers;
}

function makeAgreement(
  rng: () => number,
  index: number,
  customers: CustomerRecord[],
  sites: SiteRecord[],
  containers: ContainerRecord[],
): AgreementRecord {
  const customer = pick(rng, customers);
  const site = pick(rng, sites);
  const container = pick(rng, containers);
  return makeAgreementAt(
    rng,
    index,
    customer,
    site,
    container,
    makeRate(rng, container.sizeYards, container.type),
    false,
  );
}

function makeAgreementAt(
  rng: () => number,
  index: number,
  customer: CustomerRecord,
  site: SiteRecord,
  container: ContainerRecord,
  rateCents: number,
  forceClosed: boolean,
): AgreementRecord {
  const closed = forceClosed || chance(rng, config.demo.dirt.closedAgreementRate);
  const billed = !closed || !chance(rng, config.demo.dirt.closedUnbilledRate);
  const unmappable = chance(rng, config.demo.dirt.unmappableCodeRate);
  const serviceCode = unmappable ? pick(rng, UNMAPPABLE_CODES) : makeServiceCode(rng, container.type, container.sizeYards);
  const startDate = makeDirtyDate(rng);
  const endDate = closed ? makeDirtyDate(rng) : null;
  return {
    id: `A-${pad(index + 1, 5)}`,
    customerId: customer.id,
    siteId: site.id,
    containerId: container.id,
    serviceCode,
    rateCents,
    startDate,
    endDate,
    status: closed ? "closed" : "active",
    billed,
    source: pick(rng, AGREEMENT_SOURCES),
  };
}

function generateAgreements(
  rng: () => number,
  count: number,
  customers: CustomerRecord[],
  sites: SiteRecord[],
  containers: ContainerRecord[],
): AgreementRecord[] {
  const agreements: AgreementRecord[] = [];
  const conflictPairs = config.demo.dirt.conflictingPricingPairs;
  const normalCount = count - conflictPairs * 2;
  for (let i = 0; i < normalCount; i += 1) {
    agreements.push(makeAgreement(rng, i, customers, sites, containers));
  }
  for (let p = 0; p < conflictPairs; p += 1) {
    const container = pick(rng, containers);
    const site =
      container.siteId !== null
        ? (sites.find((s) => s.id === container.siteId) ?? pick(rng, sites))
        : pick(rng, sites);
    const customer = pick(rng, customers);
    const rate1 = makeRate(rng, container.sizeYards, container.type);
    const rate2 = rate1 + int(rng, 1, 3) * 500;
    const index = normalCount + p * 2;
    agreements.push(makeAgreementAt(rng, index, customer, site, container, rate1, false));
    agreements.push(makeAgreementAt(rng, index + 1, customer, site, container, rate2, false));
  }
  return agreements;
}

function generateRoutes(rng: () => number, count: number, sites: SiteRecord[]): RouteRecord[] {
  const routes: RouteRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const siteCount = 2 + int(rng, 0, 6);
    const siteIds: string[] = [];
    for (let s = 0; s < siteCount; s += 1) {
      siteIds.push(pick(rng, sites).id);
    }
    routes.push({
      id: `R-${pad(i + 1, 4)}`,
      name: `Route ${i + 1} - ${pick(rng, YARDS)}`,
      dayOfWeek: pick(rng, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
      siteIds,
      source: pick(rng, ROUTE_SOURCES),
    });
  }
  return routes;
}

function generateTickets(
  rng: () => number,
  count: number,
  containers: ContainerRecord[],
  agreements: AgreementRecord[],
): TicketRecord[] {
  const tickets: TicketRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const unmatched = chance(rng, config.demo.dirt.unmatchedTicketRate);
    const container = unmatched ? null : pick(rng, containers);
    const agreement = unmatched ? null : pick(rng, agreements);
    tickets.push({
      id: `T-${pad(i + 1, 5)}`,
      date: makeDirtyDate(rng),
      containerId: container?.id ?? null,
      agreementId: agreement?.id ?? null,
      grossTons: int(rng, 25, 180) / 10,
      source: pick(rng, TICKET_SOURCES),
    });
  }
  return tickets;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export function generateDataset(seed: number = config.demo.seed): GeneratedDataset {
  const counts = config.demo.counts;
  const total =
    counts.customers + counts.sites + counts.containers + counts.agreements + counts.routes + counts.tickets;
  if (total !== config.demo.totalRecords) {
    throw new Error(`Dataset counts sum to ${total}, expected ${config.demo.totalRecords}`);
  }

  const rng = mulberry32(seed);
  const customers = generateCustomers(rng, counts.customers, config.demo.dirt.duplicateClusters);
  const sites = generateSites(rng, counts.sites, customers);
  const containers = generateContainers(rng, counts.containers, sites);
  const agreements = generateAgreements(rng, counts.agreements, customers, sites, containers);
  const routes = generateRoutes(rng, counts.routes, sites);
  const tickets = generateTickets(rng, counts.tickets, containers, agreements);

  return { customers, sites, containers, agreements, routes, tickets, total };
}

/** FNV-1a 32-bit hash, hex-encoded. Deterministic across platforms. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Serializes the dataset in a fixed key order and hashes it. */
export function hashDataset(dataset: GeneratedDataset): string {
  const serialized = JSON.stringify({
    customers: dataset.customers,
    sites: dataset.sites,
    containers: dataset.containers,
    agreements: dataset.agreements,
    routes: dataset.routes,
    tickets: dataset.tickets,
  });
  return fnv1a(serialized);
}
