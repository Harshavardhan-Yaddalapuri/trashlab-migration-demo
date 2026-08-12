/**
 * Role-based authorization for exception review.
 *
 * Rules:
 *   - owner: can approve/reject pricing_conflict exceptions
 *   - dispatcher: can approve/reject route_conflict exceptions
 *   - admin: can approve/reject any exception type
 *   - All roles can resolve non-gated exception types (orphan_container, etc.)
 */

import type { ExceptionCard, ReviewRole } from "./types";

/** Exception types that are role-gated. */
const GATED_TYPES: Record<string, ReviewRole> = {
  pricing_conflict: "owner",
  route_conflict: "dispatcher",
};

/**
 * Check whether a role is authorized to resolve an exception.
 * Returns true if authorized, false otherwise.
 */
export function canResolve(role: ReviewRole, card: ExceptionCard): boolean {
  // Admin can resolve anything.
  if (role === "admin") return true;

  const requiredRole = GATED_TYPES[card.type];
  if (requiredRole === undefined) {
    // Not a gated type — any role can resolve.
    return true;
  }

  return role === requiredRole;
}

/**
 * Check whether a role is authorized to bulk-resolve exceptions of a given type.
 */
export function canBulkResolve(role: ReviewRole, exceptionType: string): boolean {
  if (role === "admin") return true;

  const requiredRole = GATED_TYPES[exceptionType];
  if (requiredRole === undefined) return true;

  return role === requiredRole;
}

/**
 * Return the required role for a gated exception type, or null if not gated.
 */
export function requiredRoleFor(exceptionType: string): ReviewRole | null {
  return GATED_TYPES[exceptionType] ?? null;
}

/**
 * Get a human-readable reason why a role cannot resolve an exception.
 */
export function denialReason(role: ReviewRole, card: ExceptionCard): string {
  const requiredRole = GATED_TYPES[card.type];
  if (requiredRole === undefined) {
    return `Role "${role}" cannot resolve exception "${card.id}" of type "${card.type}"`;
  }
  return `Role "${role}" cannot resolve "${card.type}" exceptions. Required role: "${requiredRole}"`;
}
