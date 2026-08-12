/**
 * Eval layer: golden-set metrics for the migration pipeline.
 * auto-map accuracy, exception rate, silent-error detection, confidence histogram, calibration.
 * LangSmith eval integration.
 */

import { goldenSet, plantedSilentError, type GoldenFixture } from "./golden-set";
import { mapServiceCode, type MappedServiceCode } from "../rules/code-mapper";
import { normalizeDate } from "../rules/date-normalizer";
import { normalizeContainerId } from "../rules/id-normalizer";
import { customerBlockingKey, normalizeAddress } from "../rules/dedup-keys";

export interface EvalMetrics {
  autoMapRate: number; // 0..1
  exceptionRate: number; // 0..1
  silentErrors: number;
  confidenceCalibration: number; // 0..1
  confidenceHistogram: ConfidenceHistogram;
  perEntityType: Record<string, EntityTypeMetrics>;
}

export interface EvalInput {
  totalRecords: number;
  autoMapped: number;
  exceptionCount: number;
  silentErrors: number;
  confidenceSum: number;
  confidenceCount: number;
  confidenceBuckets?: number[]; // histogram buckets
  perEntityType?: Record<string, EntityTypeInput>;
}

export interface EntityTypeInput {
  total: number;
  autoMapped: number;
  exceptions: number;
  confidenceSum: number;
  confidenceCount: number;
}

export interface EntityTypeMetrics {
  autoMapRate: number;
  exceptionRate: number;
  avgConfidence: number;
  count: number;
}

export interface ConfidenceHistogram {
  buckets: Array<{ range: string; count: number; percentage: number }>;
  total: number;
}

export interface SilentErrorResult {
  detected: boolean;
  fixtureId: string;
  actualConfidence: number;
  expectedMapping: Record<string, string>;
  actualMapping: Record<string, string>;
  reason: string;
}

export interface LangSmithEvalConfig {
  projectName: string;
  datasetName: string;
  apiKey?: string;
}

export function computeMetrics(input: EvalInput): EvalMetrics {
  const autoMapRate = input.totalRecords === 0 ? 0 : input.autoMapped / input.totalRecords;
  const exceptionRate = input.totalRecords === 0 ? 0 : input.exceptionCount / input.totalRecords;
  const confidenceCalibration = input.confidenceCount === 0 ? 0 : input.confidenceSum / input.confidenceCount;

  // Build confidence histogram (10 buckets: 0.0-0.1, 0.1-0.2, ..., 0.9-1.0)
  const buckets = input.confidenceBuckets || Array(10).fill(0);
  const totalBucketed = buckets.reduce((a, b) => a + b, 0);
  const histogram: ConfidenceHistogram = {
    buckets: buckets.map((count, i) => ({
      range: `${(i * 0.1).toFixed(1)}-${((i + 1) * 0.1).toFixed(1)}`,
      count,
      percentage: totalBucketed === 0 ? 0 : count / totalBucketed,
    })),
    total: totalBucketed,
  };

  // Per-entity-type metrics
  const perEntityType: Record<string, EntityTypeMetrics> = {};
  if (input.perEntityType) {
    for (const [entityType, data] of Object.entries(input.perEntityType)) {
      perEntityType[entityType] = {
        autoMapRate: data.total === 0 ? 0 : data.autoMapped / data.total,
        exceptionRate: data.total === 0 ? 0 : data.exceptions / data.total,
        avgConfidence: data.confidenceCount === 0 ? 0 : data.confidenceSum / data.confidenceCount,
        count: data.total,
      };
    }
  }

  return {
    autoMapRate,
    exceptionRate,
    silentErrors: input.silentErrors,
    confidenceCalibration,
    confidenceHistogram: histogram,
    perEntityType,
  };
}

export function evalGatePasses(metrics: EvalMetrics): boolean {
  return metrics.silentErrors === 0 && metrics.autoMapRate >= 0.95;
}

/**
 * Run a single golden-set fixture through the relevant mapper/normalizer
 * and compare against expected output.
 */
export function runGoldenFixture(fixture: GoldenFixture): {
  passed: boolean;
  actual: Record<string, string>;
  confidence: number;
  details: string[];
} {
  const details: string[] = [];
  let actual: Record<string, string> = {};
  let confidence = 0;

  switch (fixture.entityType) {
    case "customer": {
      const name = fixture.input.name || "";
      const phone = fixture.input.phone || "";
      const address = fixture.input.address || "";
      const key = customerBlockingKey(name, phone, address);
      actual = { blockingKey: key };
      confidence = 1.0; // blocking key is deterministic
      details.push(`blockingKey=${key}`);
      break;
    }
    case "site": {
      // Sites use address normalization (uppercase)
      actual = {
        name: fixture.input.name?.toUpperCase() || "",
        address: normalizeAddress(fixture.input.address || ""),
        city: fixture.input.city?.toUpperCase() || "",
        state: fixture.input.state?.toUpperCase() || "",
        zip: fixture.input.zip || "",
      };
      confidence = 1.0;
      details.push("uppercase normalization");
      break;
    }
    case "container": {
      const normalized = normalizeContainerId(fixture.input.containerId || "");
      actual = { containerId: normalized };
      confidence = normalized ? 1.0 : 0;
      details.push(`normalized=${normalized}`);
      break;
    }
    case "agreement": {
      const mapped: MappedServiceCode | null = mapServiceCode(fixture.input.serviceCode || "");
      if (mapped) {
        actual = {
          lineOfBusiness: mapped.lineOfBusiness || "",
          sizeYards: mapped.sizeYards?.toString() || "",
          frequency: mapped.frequency || "",
          retired: mapped.retired.toString(),
        };
        confidence = mapped.confidence;
        details.push(`confidence=${mapped.confidence.toFixed(3)}`);
        if (mapped.retired) details.push(`retiredAs=${mapped.retiredAs}`);
      } else {
        actual = {};
        confidence = 0;
        details.push("no mapping returned");
      }
      break;
    }
    case "route": {
      actual = {
        templateId: fixture.input.templateId || "",
        name: fixture.input.name?.toUpperCase() || "",
        stops: fixture.input.stops || "",
        frequency: fixture.input.frequency || "",
      };
      confidence = 1.0;
      details.push("uppercase normalization");
      break;
    }
    case "ticket": {
      const dateResult = normalizeDate(fixture.input.date || "");
      actual = {
        ticketId: fixture.input.ticketId || "",
        containerId: normalizeContainerId(fixture.input.containerId || "") || "",
        weightLbs: fixture.input.weightLbs || "",
        date: dateResult.iso || "",
      };
      confidence = dateResult.iso ? 1.0 : 0;
      details.push(`date=${dateResult.iso}`);
      break;
    }
  }

  // Compare actual vs expected (only check fields that exist in expected)
  let passed = true;
  for (const [key, expectedValue] of Object.entries(fixture.expected)) {
    const actualValue = actual[key];
    if (actualValue !== expectedValue) {
      passed = false;
      details.push(`MISMATCH ${key}: expected="${expectedValue}" actual="${actualValue}"`);
    }
  }

  return { passed, actual, confidence, details };
}

/**
 * Run the full golden set and aggregate metrics.
 */
export function runGoldenSet(): EvalInput {
  const perEntityType: Record<string, EntityTypeInput> = {};
  let totalRecords = 0;
  let autoMapped = 0;
  let exceptionCount = 0;
  let silentErrors = 0;
  const confidenceSum = 0;
  const confidenceCount = 0;
  const confidenceBuckets = Array(10).fill(0);

  for (const fixture of goldenSet) {
    const result = runGoldenFixture(fixture);
    totalRecords++;

    // Initialize per-entity-type tracking
    if (!perEntityType[fixture.entityType]) {
      perEntityType[fixture.entityType] = {
        total: 0,
        autoMapped: 0,
        exceptions: 0,
        confidenceSum: 0,
        confidenceCount: 0,
      };
    }
    const typeData = perEntityType[fixture.entityType];
    typeData.total++;
    typeData.confidenceSum += result.confidence;
    typeData.confidenceCount++;

    // Bucket confidence
    const bucketIndex = Math.min(9, Math.floor(result.confidence * 10));
    confidenceBuckets[bucketIndex]++;

    if (result.passed) {
      if (result.confidence >= 0.7) {
        // High confidence + correct = auto-mapped
        autoMapped++;
        typeData.autoMapped++;
      } else {
        // Low confidence + correct = exception (review)
        exceptionCount++;
        typeData.exceptions++;
      }
    } else {
      // Incorrect mapping
      if (result.confidence >= 0.7) {
        // High confidence but WRONG = silent error
        silentErrors++;
        typeData.exceptions++; // Counted as exception in gate
      } else {
        // Low confidence and wrong = caught by review
        exceptionCount++;
        typeData.exceptions++;
      }
    }
  }

  return {
    totalRecords,
    autoMapped,
    exceptionCount,
    silentErrors,
    confidenceSum,
    confidenceCount,
    confidenceBuckets,
    perEntityType,
  };
}

/**
 * Silent-error detection: runs the planted silent error fixture
 * and verifies it's caught (high confidence but wrong output).
 */
export function detectSilentErrors(): SilentErrorResult[] {
  const results: SilentErrorResult[] = [];

  // Test the planted silent error
  const result = runGoldenFixture(plantedSilentError);

  const detected = result.confidence >= 0.7 && !result.passed;

  results.push({
    detected,
    fixtureId: plantedSilentError.id,
    actualConfidence: result.confidence,
    expectedMapping: plantedSilentError.expected,
    actualMapping: result.actual,
    reason: detected
      ? `Silent error caught: mapper returned confidence ${result.confidence.toFixed(3)} but mapping is incorrect`
      : "Silent error NOT detected - mapper confidence was low or mapping was correct",
  });

  return results;
}

/**
 * Confidence calibration check: bins predictions by confidence and checks
 * actual accuracy per bin. Well-calibrated models have accuracy ~= confidence.
 */
export function computeCalibration(): Array<{ bin: string; confidence: number; accuracy: number; count: number }> {
  const bins: Array<{ total: number; correct: number; confSum: number }> = Array(10)
    .fill(null)
    .map(() => ({ total: 0, correct: 0, confSum: 0 }));

  for (const fixture of goldenSet) {
    const result = runGoldenFixture(fixture);
    const binIndex = Math.min(9, Math.floor(result.confidence * 10));
    bins[binIndex].total++;
    bins[binIndex].confSum += result.confidence;
    if (result.passed) bins[binIndex].correct++;
  }

  return bins
    .filter((b) => b.total > 0)
    .map((b, i) => ({
      bin: `${(i * 0.1).toFixed(1)}-${((i + 1) * 0.1).toFixed(1)}`,
      confidence: b.confSum / b.total,
      accuracy: b.correct / b.total,
      count: b.total,
    }));
}

/**
 * LangSmith evaluation integration.
 * Runs the golden set as a LangSmith experiment/dataset evaluation.
 */
export async function runLangSmithEval(config: LangSmithEvalConfig): Promise<{
  experimentName: string;
  results: Array<{ fixtureId: string; passed: boolean; score: number; latencyMs: number }>;
  summary: { passed: number; total: number; avgScore: number };
}> {
  const { projectName, datasetName } = config;
  const apiKey = config.apiKey || process.env.LANGSMITH_API_KEY;

  if (!apiKey) {
    throw new Error("LANGSMITH_API_KEY not provided");
  }

  // Import LangSmith dynamically to avoid bundling issues
  const { Client } = await import("langsmith");
  const client = new Client({ apiKey });

  const experimentName = `golden-set-${Date.now()}`;
  const dataset = await client.readDataset({ datasetName });

  if (!dataset) {
    throw new Error(`Dataset "${datasetName}" not found in LangSmith`);
  }

  const results: Array<{ fixtureId: string; passed: boolean; score: number; latencyMs: number }> = [];

  // Run each fixture as an experiment example
  for (const fixture of goldenSet) {
    const start = Date.now();
    const result = runGoldenFixture(fixture);
    const latencyMs = Date.now() - start;

    // Score: 1.0 if passed, confidence * 0.5 if failed (partial credit for low-confidence failures)
    const score = result.passed ? 1.0 : result.confidence * 0.5;

    results.push({
      fixtureId: fixture.id,
      passed: result.passed,
      score,
      latencyMs,
    });

    // Log to LangSmith
    await client.createRun({
      name: `golden-fixture-${fixture.id}`,
      run_type: "chain",
      inputs: { fixture },
      outputs: { passed: result.passed, confidence: result.confidence, actual: result.actual },
      extra: { metadata: { entityType: fixture.entityType, score } },
      project_name: projectName,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const avgScore = results.reduce((a, r) => a + r.score, 0) / results.length;

  return {
    experimentName,
    results,
    summary: { passed, total: results.length, avgScore },
  };
}

/**
 * Quick smoke test for CI - runs golden set and asserts gate passes.
 * Throws if eval gate fails.
 */
export function assertEvalGate(): void {
  const input = runGoldenSet();
  const metrics = computeMetrics(input);
  const silentErrors = detectSilentErrors();

  const allSilentErrorsCaught = silentErrors.every((e) => e.detected);

  if (!evalGatePasses(metrics) || !allSilentErrorsCaught) {
    const calibration = computeCalibration();
    throw new Error(
      `Eval gate FAILED:\n` +
        `  autoMapRate: ${(metrics.autoMapRate * 100).toFixed(1)}% (need >= 95%)\n` +
        `  exceptionRate: ${(metrics.exceptionRate * 100).toFixed(1)}%\n` +
        `  silentErrors: ${metrics.silentErrors} (need 0)\n` +
        `  allSilentErrorsCaught: ${allSilentErrorsCaught}\n` +
        `  confidenceCalibration: ${(metrics.confidenceCalibration * 100).toFixed(1)}%\n` +
        `  calibration: ${JSON.stringify(calibration, null, 2)}`
    );
  }
}