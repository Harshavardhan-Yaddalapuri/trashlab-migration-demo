/**
 * Training domain types. Role-based training packets in plain language.
 * LLM-generated via LangChain LCEL with deterministic fallback.
 */

/** The four roles that receive training packets. */
export type TrainingRole = "owner" | "dispatcher" | "driver" | "csr";

/** A section within a training packet. */
export interface TrainingSection {
  /** Section heading (e.g. "Your Daily Loop"). */
  heading: string;
  /** Plain-language body text. */
  body: string;
}

/** A complete training packet for one role. */
export interface TrainingPacket {
  /** Which role this packet is for. */
  role: TrainingRole;
  /** Packet title. */
  title: string;
  /** Ordered sections. */
  sections: TrainingSection[];
  /** When the packet was generated. ISO-8601. */
  generatedAt: string;
  /** Whether the LLM or deterministic fallback produced this. */
  generatedBy: "llm" | "fallback";
}

/** Input data fed to the training generator. */
export interface TrainingInput {
  /** The migration job ID. */
  jobId: string;
  /** How many records were auto-mapped. */
  autoMapped: number;
  /** How many exceptions were raised. */
  exceptionCount: number;
  /** Total records in the migration. */
  totalRecords: number;
  /** Days to go-live (from the report). */
  goLiveDays: number;
  /** Auto-map rate (0..1). */
  autoMapRate: number;
}

/** Result of generating all training packets. */
export interface TrainingResult {
  /** One packet per role. */
  packets: TrainingPacket[];
  /** Which generator produced the result. */
  generatedBy: "llm" | "fallback";
}

/** LangChain LCEL prompt input shape. */
export interface TrainingPromptInput {
  role: TrainingRole;
  autoMapped: number;
  exceptionCount: number;
  totalRecords: number;
  goLiveDays: number;
  autoMapRate: number;
}
