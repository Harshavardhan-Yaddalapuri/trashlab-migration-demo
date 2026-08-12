import { describe, expect, it } from "vitest";
import {
  goldenSet,
  plantedSilentError,
  getFixturesByType,
  getAllFixtureIds,
} from "./golden-set";
import {
  computeMetrics,
  evalGatePasses,
  runGoldenFixture,
  runGoldenSet,
  detectSilentErrors,
  computeCalibration,
  assertEvalGate,
} from "./metrics";

describe("golden-set fixtures", () => {
  it("has fixtures for all entity types", () => {
    const types = ["customer", "site", "container", "agreement", "route", "ticket"] as const;
    for (const type of types) {
      const fixtures = getFixturesByType(type);
      expect(fixtures.length).toBeGreaterThan(0);
    }
  });

  it("has the expected total fixture count", () => {
    expect(goldenSet.length).toBe(26);
  });

  it("has unique IDs", () => {
    const ids = getAllFixtureIds();
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("planted silent error is a separate fixture", () => {
    expect(plantedSilentError.id).toBe("g-silent-error-001");
    expect(plantedSilentError.entityType).toBe("agreement");
    // The planted error has WRONG expected output
    expect(plantedSilentError.expected.lineOfBusiness).toBe("rolloff");
    // But the correct mapping for SW-COMM-2YD is frontload
  });
});

describe("runGoldenFixture", () => {
  it("passes customer fixtures with blocking key", () => {
    const fixture = goldenSet.find((f) => f.id === "g-customer-001")!;
    const result = runGoldenFixture(fixture);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(1.0);
    expect(result.actual.blockingKey).toBeDefined();
  });

  it("passes duplicate customer variants with same blocking key", () => {
    const c1 = runGoldenFixture(goldenSet.find((f) => f.id === "g-customer-001")!);
    const c2 = runGoldenFixture(goldenSet.find((f) => f.id === "g-customer-002")!);
    // g-customer-003 "S. Construction" is an abbreviation, not a legal-suffix variant
    // Only legal-suffix variants (LLC/Inc/Corp) should produce same blocking key
    expect(c1.actual.blockingKey).toBe(c2.actual.blockingKey);
  });

  it("passes site fixtures with uppercase normalization", () => {
    const fixture = goldenSet.find((f) => f.id === "g-site-001")!;
    const result = runGoldenFixture(fixture);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(1.0);
    expect(result.actual.name).toBe("DOWNTOWN YARD");
  });

  it("passes container fixtures with ID normalization", () => {
    const fixtures = getFixturesByType("container");
    for (const fixture of fixtures) {
      const result = runGoldenFixture(fixture);
      expect(result.passed).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.actual.containerId).toBe(fixture.expected.containerId);
    }
  });

  it("passes agreement fixtures with correct service code mapping", () => {
    const fixtures = getFixturesByType("agreement");
    for (const fixture of fixtures) {
      const result = runGoldenFixture(fixture);
      expect(result.passed).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.actual.lineOfBusiness).toBe(fixture.expected.lineOfBusiness);
      expect(result.actual.sizeYards).toBe(fixture.expected.sizeYards);
    }
  });

  it("passes route fixtures", () => {
    const fixtures = getFixturesByType("route");
    for (const fixture of fixtures) {
      const result = runGoldenFixture(fixture);
      expect(result.passed).toBe(true);
      expect(result.confidence).toBe(1.0);
    }
  });

  it("passes ticket fixtures with date normalization", () => {
    const fixtures = getFixturesByType("ticket");
    for (const fixture of fixtures) {
      const result = runGoldenFixture(fixture);
      expect(result.passed).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.actual.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("eval metrics", () => {
  it("computes rates and passes the gate with zero silent errors", () => {
    const metrics = computeMetrics({
      totalRecords: 1000,
      autoMapped: 992,
      exceptionCount: 8,
      silentErrors: 0,
      confidenceSum: 0.9,
      confidenceCount: 1,
    });
    expect(metrics.autoMapRate).toBeCloseTo(0.992);
    expect(metrics.exceptionRate).toBeCloseTo(0.008);
    expect(evalGatePasses(metrics)).toBe(true);
  });

  it("fails the gate on silent errors", () => {
    const metrics = computeMetrics({
      totalRecords: 1000,
      autoMapped: 1000,
      exceptionCount: 0,
      silentErrors: 1,
      confidenceSum: 1,
      confidenceCount: 1,
    });
    expect(evalGatePasses(metrics)).toBe(false);
  });

  it("fails the gate when autoMapRate below 95%", () => {
    const metrics = computeMetrics({
      totalRecords: 1000,
      autoMapped: 900,
      exceptionCount: 100,
      silentErrors: 0,
      confidenceSum: 0.8,
      confidenceCount: 1,
    });
    expect(evalGatePasses(metrics)).toBe(false);
  });

  it("produces confidence histogram with 10 buckets", () => {
    const metrics = computeMetrics({
      totalRecords: 100,
      autoMapped: 95,
      exceptionCount: 5,
      silentErrors: 0,
      confidenceSum: 85,
      confidenceCount: 100,
      confidenceBuckets: [0, 0, 0, 5, 10, 20, 25, 20, 15, 5],
    });
    expect(metrics.confidenceHistogram.buckets.length).toBe(10);
    expect(metrics.confidenceHistogram.total).toBe(100);
    // Check bucket ranges
    expect(metrics.confidenceHistogram.buckets[0].range).toBe("0.0-0.1");
    expect(metrics.confidenceHistogram.buckets[9].range).toBe("0.9-1.0");
    // Check percentages sum to 1
    const sum = metrics.confidenceHistogram.buckets.reduce((a, b) => a + b.percentage, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("produces per-entity-type metrics", () => {
    const metrics = computeMetrics({
      totalRecords: 100,
      autoMapped: 95,
      exceptionCount: 5,
      silentErrors: 0,
      confidenceSum: 85,
      confidenceCount: 100,
      perEntityType: {
        customer: { total: 50, autoMapped: 48, exceptions: 2, confidenceSum: 45, confidenceCount: 50 },
        agreement: { total: 50, autoMapped: 47, exceptions: 3, confidenceSum: 40, confidenceCount: 50 },
      },
    });
    expect(metrics.perEntityType.customer.autoMapRate).toBeCloseTo(0.96);
    expect(metrics.perEntityType.agreement.autoMapRate).toBeCloseTo(0.94);
    expect(metrics.perEntityType.customer.avgConfidence).toBeCloseTo(0.9);
    expect(metrics.perEntityType.agreement.avgConfidence).toBeCloseTo(0.8);
  });
});

describe("runGoldenSet", () => {
  it("aggregates metrics across all fixtures", () => {
    const input = runGoldenSet();
    expect(input.totalRecords).toBe(goldenSet.length);
    expect(input.autoMapped).toBeGreaterThan(0);
    expect(input.confidenceBuckets).toBeDefined();
    expect(input.confidenceBuckets!.length).toBe(10);
    expect(input.perEntityType).toBeDefined();
  });

  it("produces valid EvalInput for computeMetrics", () => {
    const input = runGoldenSet();
    const metrics = computeMetrics(input);
    expect(metrics.autoMapRate).toBeGreaterThanOrEqual(0);
    expect(metrics.autoMapRate).toBeLessThanOrEqual(1);
    expect(metrics.exceptionRate).toBeGreaterThanOrEqual(0);
    expect(metrics.confidenceHistogram.buckets.length).toBe(10);
  });
});

describe("silent-error detection", () => {
  it("detects the planted silent error", () => {
    const results = detectSilentErrors();
    expect(results.length).toBe(1);
    const result = results[0];
    expect(result.fixtureId).toBe("g-silent-error-001");
    expect(result.detected).toBe(true);
    expect(result.actualConfidence).toBeGreaterThanOrEqual(0.7);
    expect(result.actualMapping.lineOfBusiness).toBe("frontload"); // Correct mapping
    expect(result.expectedMapping.lineOfBusiness).toBe("rolloff"); // Planted wrong expectation
  });

  it("silent error has high confidence but wrong mapping", () => {
    const results = detectSilentErrors();
    const result = results[0];
    // The mapper correctly maps SW-COMM-2YD to frontload with high confidence
    // But the planted fixture expects rolloff - this IS a silent error (confident but wrong)
    expect(result.actualConfidence).toBe(1.0); // canonical mapping = 1.0 confidence
    expect(result.detected).toBe(true);
  });
});

describe("confidence calibration", () => {
  it("produces calibration bins with accuracy per confidence range", () => {
    const calibration = computeCalibration();
    expect(calibration.length).toBeGreaterThan(0);
    for (const bin of calibration) {
      expect(bin.confidence).toBeGreaterThanOrEqual(0);
      expect(bin.confidence).toBeLessThanOrEqual(1);
      expect(bin.accuracy).toBeGreaterThanOrEqual(0);
      expect(bin.accuracy).toBeLessThanOrEqual(1);
      expect(bin.count).toBeGreaterThan(0);
    }
  });
});

describe("eval gate assertion", () => {
  it("passes the full eval gate with current golden set", () => {
    // This should not throw
    expect(() => assertEvalGate()).not.toThrow();
  });
});