/**
 * Review feature: exception queue, HITL actions, audit trail, role gating.
 * Barrel export — import from "@/features/review".
 */

export {
  approveException,
  bulkResolve,
  editThenApprove,
  rejectException,
  resetCounters,
  toExceptionCard,
} from "./actions";

export {
  appendAudit,
  appendAuditBatch,
  auditCountForJob,
  clearAudit,
  getAllAudit,
  getAuditForException,
  getAuditForJob,
} from "./audit";

export {
  canBulkResolve,
  canResolve,
  denialReason,
  requiredRoleFor,
} from "./role-gate";

export {
  clearExceptionStore,
  getException,
  getExceptionsForJob,
  putException,
  putExceptions,
  updateException,
} from "./exception-store";

export type {
  ApproveMode,
  ApproveRequest,
  AuditEntry,
  BulkResolveRequest,
  BulkResolveResult,
  ExceptionCard,
  GatedExceptionType,
  RejectRequest,
  ReviewAction,
  ReviewDecision,
  ReviewRole,
} from "./types";
