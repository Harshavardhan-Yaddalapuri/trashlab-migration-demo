/**
 * Review agent: human-in-the-loop gate. Approves or rejects exceptions.
 * This is the guardrail boundary: irreversible decisions need a human.
 */

import type { ExceptionIssue } from "@/lib/types";
import type { AgentContext, ReviewAgent, ReviewResult } from "./contracts";

export class DeterministicReviewAgent implements ReviewAgent {
  async run(ctx: AgentContext, exceptions: ExceptionIssue[]): Promise<ReviewResult> {
    const approved: ExceptionIssue[] = [];
    const rejected: ExceptionIssue[] = [];

    for (const exception of exceptions) {
      if (exception.reviewStatus === "approved") {
        approved.push(exception);
      } else if (exception.reviewStatus === "rejected") {
        rejected.push(exception);
      }
    }

    return { approved, rejected };
  }
}

export const reviewAgent: ReviewAgent = new DeterministicReviewAgent();
