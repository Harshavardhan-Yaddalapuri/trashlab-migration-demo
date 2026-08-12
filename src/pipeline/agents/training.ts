/**
 * Training agent: role-based training packets in plain language.
 * LLM prose generation is optional; the deterministic skeleton is here.
 */

import type { AgentContext, TrainingAgent, TrainingResult } from "./contracts";

const ROLES = ["owner", "dispatcher", "driver", "csr"] as const;

export class DeterministicTrainingAgent implements TrainingAgent {
  async run(
    ctx: AgentContext,
    report: { autoMapped: number; exceptionCount: number },
  ): Promise<TrainingResult> {
    const packets = ROLES.map((role) => ({
      role,
      title: `${role} training packet`,
      body:
        `Your yard is live. ${report.autoMapped} records mapped automatically, ` +
        `${report.exceptionCount} exceptions reviewed. This packet covers the daily loop.`,
    }));
    return { packets };
  }
}

export const trainingAgent: TrainingAgent = new DeterministicTrainingAgent();
