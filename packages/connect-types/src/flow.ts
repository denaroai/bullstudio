import type { JobStatus } from "./job";

export interface FlowNode {
  id: string;
  name: string;
  queueName: string;
  status: JobStatus;
  data: unknown;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  children: FlowNode[] | undefined;
}

export interface FlowSummary {
  id: string;
  name: string;
  queueName: string;
  prefix?: string;
  status: JobStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  timestamp: number;
}

export interface FlowTree {
  id: string;
  root: FlowNode;
  queueName: string;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
}
