/**
 * Training feature: barrel export.
 */

export {
  generateTrainingPackets,
  generateTrainingPacketsSync,
  getPacketForRole,
} from "./generate";

export type {
  TrainingInput,
  TrainingPacket,
  TrainingResult,
  TrainingRole,
  TrainingSection,
} from "./types";
