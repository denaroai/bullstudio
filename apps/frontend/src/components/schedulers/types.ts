import type { JobScheduler } from "@bullstudio/connect-types";

export type PrivateScheduler = JobScheduler & { queueKey?: string };

export interface QueueTarget {
  queueKey?: string;
  queueName: string;
  prefix?: string;
}

export interface SchedulerQueueOption {
  key?: string;
  name: string;
  prefix?: string;
}
