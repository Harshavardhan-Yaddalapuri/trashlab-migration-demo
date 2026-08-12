/**
 * Mapper agent: legacy service codes -> target model with confidence.
 *
 * A LangGraph node that processes resolved entities, runs every service code
 * through the deterministic code-mapper, and produces MappingProposed events.
 *
 * Confidence distribution:
 *   >= mappingExceptionThreshold -> auto-mapped (counted in autoMapped)
 *   <  mappingExceptionThreshold -> MappingProposed + ExceptionRaised
 *   unknown / unmappable codes   -> ExceptionRaised (never silent auto-commit)
 *
 * Rule table version travels with each proposal so rule bumps can re-evaluate
 * only the records that hit the changed rule.
 */

import type { ExceptionIssue, MappingProposal, ResolvedEntity } from "@/lib/types";
import { config } from "@/lib/config";
import { mapServiceCode } from "@/pipeline/rules/code-mapper";
import type { AgentContext, MapAgent, MapResult } from "./contracts";

function isAgreementEntity(entity: ResolvedEntity): boolean {
  return entity.canonicalFields["serviceCode"] !== undefined || entity.entityType === "agreement";
}

function buildException(ctx: AgentContext, entity: ResolvedEntity, code: string, reason: string): ExceptionIssue {
  return {
    id: `exc-map-${entity.id}`,
    jobId: ctx.jobId,
    type: "low_mapping_confidence",
    severity: "info",
    summary: reason,
    evidence: [entity.id, code],
    suggestedFix: "Review mapping suggestion or add a rule",
    reviewStatus: "open",
    createdAt: ctx.now(),
  };
}

export class MapperAgent implements MapAgent {
  async run(ctx: AgentContext, entities: ResolvedEntity[]): Promise<MapResult> {
    const proposals: MappingProposal[] = [];
    const exceptions: ExceptionIssue[] = [];
    let autoMapped = 0;

    for (const entity of entities) {
      if (!isAgreementEntity(entity)) {
        continue;
      }

      const code = entity.canonicalFields["serviceCode"];
      if (code === undefined || code === "") {
        exceptions.push({
          id: `exc-map-${entity.id}`,
          jobId: ctx.jobId,
          type: "missing_service_code",
          severity: "warning",
          summary: "Agreement record has no service code",
          evidence: [entity.id],
          suggestedFix: "Provide a legacy service code or map manually",
          reviewStatus: "open",
          createdAt: ctx.now(),
        });
        continue;
      }

      const mapped = mapServiceCode(code);
      if (mapped === null) {
        // mapServiceCode only returns null for empty input; missing code handled above.
        continue;
      }

      const proposal: MappingProposal = {
        id: `p-${entity.id}`,
        resolvedEntityId: entity.id,
        targetTable: "service_agreements",
        targetId: `ag-${entity.id}`,
        confidence: mapped.confidence,
        ruleVersion: mapped.rulesVersion,
        status: "proposed",
        mappedFields: {
          lineOfBusiness: mapped.lineOfBusiness,
          sizeYards: mapped.sizeYards,
          frequency: mapped.frequency,
          retired: mapped.retired,
          retiredAs: mapped.retiredAs,
          notes: mapped.notes,
        },
      };
      proposals.push(proposal);

      if (mapped.confidence >= config.pipeline.mappingExceptionThreshold) {
        autoMapped += 1;
      } else {
        const reason = mapped.retired
          ? `Retired service code "${code}" maps to "${mapped.retiredAs ?? mapped.lineOfBusiness ?? "unknown"}"; human confirmation required`
          : `Low mapping confidence (${mapped.confidence.toFixed(3)}) for "${code}"`;
        exceptions.push(buildException(ctx, entity, code, reason));
      }
    }

    return { proposals, autoMapped, exceptions };
  }
}

export const mapperAgent: MapAgent = new MapperAgent();
