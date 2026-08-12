/**
 * Map agent: legacy service codes to the target data model.
 * Deterministic mapping with confidence; low confidence becomes an exception.
 */

import type { ExceptionIssue, MappingProposal, ResolvedEntity } from "@/lib/types";
import { config } from "@/lib/config";
import { mapServiceCode } from "@/pipeline/rules/code-mapper";
import type { AgentContext, MapAgent, MapResult } from "./contracts";

export class DeterministicMapAgent implements MapAgent {
  async run(ctx: AgentContext, entities: ResolvedEntity[]): Promise<MapResult> {
    const proposals: MappingProposal[] = [];
    const exceptions: ExceptionIssue[] = [];
    let autoMapped = 0;

    for (const entity of entities) {
      const code = entity.canonicalFields["serviceCode"];
      if (code === undefined) {
        continue;
      }
      const mapped = mapServiceCode(code);
      if (mapped === null) {
        exceptions.push({
          id: `exc-${entity.id}`,
          jobId: ctx.jobId,
          type: "unmapped_service_code",
          severity: "warning",
          summary: `Unmapped service code "${code}"`,
          evidence: [code],
          suggestedFix: "Map manually or add a mapping rule",
          reviewStatus: "open",
          createdAt: ctx.now(),
        });
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
      };
      proposals.push(proposal);

      if (mapped.confidence >= config.pipeline.mappingExceptionThreshold) {
        autoMapped += 1;
      } else {
        exceptions.push({
          id: `exc-${entity.id}`,
          jobId: ctx.jobId,
          type: "low_mapping_confidence",
          severity: "info",
          summary: `Low mapping confidence for ${code}`,
          evidence: [code, String(mapped.confidence)],
          suggestedFix: "Review mapping suggestion",
          reviewStatus: "open",
          createdAt: ctx.now(),
        });
      }
    }

    return { proposals, autoMapped, exceptions };
  }
}

export const mapAgent: MapAgent = new DeterministicMapAgent();
