import type { JobStatus } from "@bullstudio/connect-types";

export const supportedJobStatuses = [
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
  "waiting-children",
] as const satisfies readonly JobStatus[];

export type JobListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  status?: JobStatus;
  limit?: number;
  offset?: number;
  search?: string;
  sortField?: JobListSortField;
  sortOrder?: JobListSortOrder;
};

export type JobListSortField =
  | "name"
  | "queueName"
  | "status"
  | "timestamp"
  | "duration";

export type JobListSortOrder = "asc" | "desc";

export type JobListResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type JobTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  jobId: string;
};

export type JobAddInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  jobName: string;
  data?: unknown;
  delay?: number;
  attempts?: number;
};

export type JobAddResponse = {
  success: true;
  message: string;
};

export type JobLogsResponse = { logs: string[]; count: number };

export type JobRetryResponse = {
  success: true;
  message: string;
  workerCount: number;
};

export type JobRetryAllResponse = {
  success: true;
  message: string;
  count: number;
  workerCount: number;
};

export type JobRemoveResponse = {
  success: true;
  message: string;
};
