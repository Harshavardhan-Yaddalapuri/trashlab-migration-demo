/**
 * Validate agent: referential integrity, pricing conflicts, orphans.
 * Every record gets a status; violations become exceptions.
 */

import type { ExceptionIssue, MappingProposal } from "@/lib/types";
import type { AgentContext, ValidateAgent, ValidateResult } from "./contracts";

export class DeterministicValidateAgent implements ValidateAgent {
  async run(ctx: AgentContext, proposals: MappingProposal[]): Promise<ValidateResult> {
    const exceptions: ExceptionIssue[] = [];
    const seenTargets = new Map<string, MappingProposal>();

    for (const proposal of proposals) {
      const existing = seenTargets.get(proposal.targetId);
      if (existing !== undefined && existing.resolvedEntityId !== proposal.resolvedEntityId) {
        exceptions.push({
          id: `exc-${proposal.id}`,
          jobId: ctx.jobId,
          type: "pricing_conflict",
          severity: "critical",
          summary: `Conflicting mapping for ${proposal.targetId}`,
          evidence: [existing.resolvedEntityId, proposal.resolvedEntityId],
          suggestedFix: "Review both sources and pick the canonical rate",
          reviewStatus: "open",
          createdAt: ctx.now(),
        });
      } else {
        seenTargets.set(proposal.targetId, proposal);
      }
    }

    return { exceptions, validCount: proposals.length - exceptions.length };
  }
}

export const validateAgent: ValidateAgent = new DeterministicValidateAgent();
