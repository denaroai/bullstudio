import type { Worker } from "@bullstudio/connect-types";

export type PrivateWorker = Worker & { queueKey?: string };

export interface QueueActionState {
  pause: boolean;
  resume: boolean;
  drain: boolean;
}
