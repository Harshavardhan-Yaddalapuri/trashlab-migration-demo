/**
 * Central configuration. No magic numbers in application code.
 * Values are read from environment at runtime; defaults are safe
 * for local development and never contain secrets.
 */

export const config = {
  app: {
    name: "TrashLab Migration Cockpit",
    version: "0.1.0",
  },
  pipeline: {
    /** Confidence above which an entity resolution auto-merges. */
    autoMergeThreshold: 0.9,
    /** Confidence below which a mapping proposal becomes an exception. */
    mappingExceptionThreshold: 0.7,
    /** Checkpoint every N records processed. */
    checkpointEvery: 5000,
    /** Max records per source partition. */
    partitionSize: 25000,
  },
  demo: {
    /** Total records generated for the demo dataset. */
    totalRecords: 150_000,
    /** Seeded RNG seed; same seed = same data. */
    seed: 20260812,
    /** Records animated in the live sample before the full batch. */
    liveSampleSize: 500,
    /** Exact record counts per entity type. Sum equals totalRecords. */
    counts: {
      customers: 45_000,
      sites: 35_000,
      containers: 40_000,
      agreements: 18_000,
      routes: 7_000,
      tickets: 5_000,
    },
    /** Deliberate data-quality defects, seeded and reproducible. */
    dirt: {
      /** Number of duplicate-customer clusters (each 1 base + 1-3 variants). */
      duplicateClusters: 2_200,
      /** Number of same-container+site agreement pairs with two different rates. */
      conflictingPricingPairs: 150,
      /** Fraction of containers with no owning site. */
      orphanContainerRate: 0.03,
      /** Fraction of agreements that are closed. */
      closedAgreementRate: 0.08,
      /** Fraction of closed agreements left unbilled. */
      closedUnbilledRate: 0.25,
      /** Fraction of scale tickets with no container/agreement link. */
      unmatchedTicketRate: 0.04,
      /** Fraction of sites with un-geocodable addresses. */
      ungeocodableSiteRate: 0.02,
      /** Fraction of agreements carrying unmappable legacy service codes. */
      unmappableCodeRate: 0.05,
    },
  },
  db: {
    /** Keyset page size for record listing. Never OFFSET on large tables. */
    pageSize: 100,
  },
  queue: {
    /** BullMQ queue name for migration jobs. */
    name: "migration-jobs",
    /** Exponential backoff base in ms. */
    backoffBaseMs: 1000,
    /** Max backoff in ms. */
    backoffMaxMs: 60_000,
  },
  money: {
    /** Currency code for all monetary values. */
    currency: "USD",
  },
} as const;

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and configure Postgres.");
  }
  return url;
}

export function langsmithEnabled(): boolean {
  return process.env.LANGSMITH_TRACING === "true";
}
