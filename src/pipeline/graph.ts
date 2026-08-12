/**
 * Migration orchestrator as a LangGraph StateGraph.
 * Typed state, checkpointing via MemorySaver, replay support.
 * The graph is the state machine: pending -> ingesting -> normalizing
 * -> resolving -> mapping -> validating -> review -> committing -> completed.
 */

import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import type {
  ExceptionIssue,
  MappingProposal,
  MigrationStatus,
  NormalizedRecord,
  RawRecord,
  ResolvedEntity,
  SourceFile,
  AuditEvent,
} from "@/lib/types";
import { intakeAgent } from "./agents/intake-agent";
import { normalizeAgent } from "./agents/normalizer-agent";
import { entityResolverAgent } from "./agents/entity-resolver";
import { mapperAgent } from "./agents/mapper";
import { validatorAgent } from "./agents/validator";
import { reviewAgent } from "./agents/review";
import { trainingAgent } from "./agents/training";

function nowIso(): string {
  return new Date().toISOString();
}

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type AuditEventType =
  | "JobStarted"
  | "SourceParsed"
  | "RecordNormalized"
  | "CustomerResolved"
  | "MappingProposed"
  | "ExceptionRaised"
  | "JobCompleted";

function createAuditEvent(
  jobId: string,
  type: AuditEventType,
  payload: Record<string, unknown>
): AuditEvent {
  return {
    id: generateCorrelationId(),
    jobId,
    type,
    actor: "system",
    payload,
    at: nowIso(),
  };
}

const StateAnnotation = Annotation.Root({
  jobId: Annotation<string>,
  status: Annotation<MigrationStatus>,
  sourceFiles: Annotation<SourceFile[]>({ reducer: (a, b) => b, default: () => [] }),
  rawRecords: Annotation<RawRecord[]>({ reducer: (a, b) => b, default: () => [] }),
  normalized: Annotation<NormalizedRecord[]>({ reducer: (a, b) => b, default: () => [] }),
  resolved: Annotation<ResolvedEntity[]>({ reducer: (a, b) => b, default: () => [] }),
  proposals: Annotation<MappingProposal[]>({ reducer: (a, b) => b, default: () => [] }),
  exceptions: Annotation<ExceptionIssue[]>({ reducer: (a, b) => b, default: () => [] }),
  audit: Annotation<AuditEvent[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  progress: Annotation<number>({ reducer: (a, b) => b, default: () => 0 }),
  error: Annotation<string | undefined>({ reducer: (a, b) => b, default: () => undefined }),
});

type GraphState = typeof StateAnnotation.State;

async function ingestNode(state: GraphState): Promise<Partial<GraphState>> {
  const correlationId = generateCorrelationId();
  const result = await intakeAgent.run(
    { jobId: state.jobId, tenantId: "demo", now: nowIso },
    state.sourceFiles
  );

  const auditEvent = createAuditEvent(state.jobId, "JobStarted", {
    correlationId,
    sourceFileCount: state.sourceFiles.length,
  });

  const sourceParsedEvent = createAuditEvent(state.jobId, "SourceParsed", {
    correlationId,
    recordCount: result.rawRecords.length,
    parseErrorCount: result.parseErrors.length,
  });

  return {
    rawRecords: result.rawRecords,
    status: "ingesting",
    progress: 0.1,
    audit: [auditEvent, sourceParsedEvent],
  };
}

async function normalizeNode(state: GraphState): Promise<Partial<GraphState>> {
  const correlationId = generateCorrelationId();
  const result = await normalizeAgent.run(
    { jobId: state.jobId, tenantId: "demo", now: nowIso },
    state.rawRecords
  );

  const normalizedEvent = createAuditEvent(state.jobId, "RecordNormalized", {
    correlationId,
    normalizedCount: result.normalized.length,
    flaggedCount: result.flagged.length,
  });

  return {
    normalized: result.normalized,
    status: "normalizing",
    progress: 0.3,
    audit: [normalizedEvent],
  };
}

async function resolveNode(state: GraphState): Promise<Partial<GraphState>> {
  const correlationId = generateCorrelationId();
  const result = await entityResolverAgent.run(
    { jobId: state.jobId, tenantId: "demo", now: nowIso },
    state.normalized
  );

  const resolvedEvent = createAuditEvent(state.jobId, "CustomerResolved", {
    correlationId,
    resolvedCount: result.resolved.length,
    autoMerged: result.autoMerged,
    needsReview: result.needsReview,
  });

  return {
    resolved: result.resolved,
    status: "resolving",
    progress: 0.5,
    audit: [resolvedEvent],
  };
}

async function mapNode(state: GraphState): Promise<Partial<GraphState>> {
  const correlationId = generateCorrelationId();
  const result = await mapperAgent.run(
    { jobId: state.jobId, tenantId: "demo", now: nowIso },
    state.resolved
  );

  const mappingEvent = createAuditEvent(state.jobId, "MappingProposed", {
    correlationId,
    proposalCount: result.proposals.length,
    autoMapped: result.autoMapped,
    exceptionCount: result.exceptions.length,
  });

  const exceptionEvents: AuditEvent[] = [];
  if (result.exceptions.length > 0) {
    for (const exc of result.exceptions) {
      exceptionEvents.push(
        createAuditEvent(state.jobId, "ExceptionRaised", {
          correlationId,
          exceptionId: exc.id,
          type: exc.type,
          severity: exc.severity,
        })
      );
    }
  }

  return {
    proposals: result.proposals,
    exceptions: [...state.exceptions, ...result.exceptions],
    status: "mapping",
    progress: 0.7,
    audit: [mappingEvent, ...exceptionEvents],
  };
}

async function validateNode(state: GraphState): Promise<Partial<GraphState>> {
  const correlationId = generateCorrelationId();
  const result = await validatorAgent.run(
    { jobId: state.jobId, tenantId: "demo", now: nowIso },
    state.proposals
  );

  const exceptionEvents: AuditEvent[] = [];
  if (result.exceptions.length > 0) {
    for (const exc of result.exceptions) {
      exceptionEvents.push(
        createAuditEvent(state.jobId, "ExceptionRaised", {
          correlationId,
          exceptionId: exc.id,
          type: exc.type,
          severity: exc.severity,
        })
      );
    }
  }

  return {
    exceptions: [...state.exceptions, ...result.exceptions],
    status: "validating",
    progress: 0.85,
    audit: exceptionEvents,
  };
}

async function reviewNode(state: GraphState): Promise<Partial<GraphState>> {
  await reviewAgent.run(
    { jobId: state.jobId, tenantId: "demo", now: nowIso },
    state.exceptions
  );
  return { status: "review", progress: 0.95 };
}

async function failedNode(state: GraphState): Promise<Partial<GraphState>> {
  const correlationId = generateCorrelationId();
  const completedEvent = createAuditEvent(state.jobId, "JobCompleted", {
    correlationId,
    proposalCount: state.proposals.length,
    exceptionCount: state.exceptions.length,
    autoMapped: 0,
    failed: true,
    criticalExceptions: state.exceptions.filter((e) => e.severity === "critical").length,
  });

  return { status: "failed", progress: 1, audit: [completedEvent] };
}

async function commitNode(state: GraphState): Promise<Partial<GraphState>> {
  const correlationId = generateCorrelationId();
  await trainingAgent.run(
    { jobId: state.jobId, tenantId: "demo", now: nowIso },
    { autoMapped: state.proposals.length, exceptionCount: state.exceptions.length }
  );

  const completedEvent = createAuditEvent(state.jobId, "JobCompleted", {
    correlationId,
    proposalCount: state.proposals.length,
    exceptionCount: state.exceptions.length,
    autoMapped: state.proposals.filter((p) => p.status === "proposed").length,
  });

  return { status: "completed", progress: 1, audit: [completedEvent] };
}

function routeAfterReview(state: GraphState): "commit" | "failed" {
  return state.exceptions.some((e) => e.severity === "critical") ? "failed" : "commit";
}

export function buildMigrationGraph() {
  const graph = new StateGraph(StateAnnotation)
    .addNode("ingest", ingestNode)
    .addNode("normalize", normalizeNode)
    .addNode("resolve", resolveNode)
    .addNode("map", mapNode)
    .addNode("validate", validateNode)
    .addNode("review", reviewNode)
    .addNode("commit", commitNode)
    .addNode("failed", failedNode)
    .addEdge(START, "ingest")
    .addEdge("ingest", "normalize")
    .addEdge("normalize", "resolve")
    .addEdge("resolve", "map")
    .addEdge("map", "validate")
    .addEdge("validate", "review")
    .addConditionalEdges("review", routeAfterReview, { commit: "commit", failed: "failed" })
    .addEdge("commit", END)
    .addEdge("failed", END);

  return graph.compile({ checkpointer: new MemorySaver() });
}

export type MigrationGraph = ReturnType<typeof buildMigrationGraph>;

export function initialState(jobId: string, sourceFiles: SourceFile[]): GraphState {
  return {
    jobId,
    status: "pending",
    sourceFiles,
    rawRecords: [],
    normalized: [],
    resolved: [],
    proposals: [],
    exceptions: [],
    audit: [],
    progress: 0,
    error: undefined,
  };
}