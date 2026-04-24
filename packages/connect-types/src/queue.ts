export interface JobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  prioritized: number;
  waitingChildren: number;
}

export interface Queue {
  name: string;
  prefix: string;
  isPaused: boolean;
  jobCounts: JobCounts;
}

export interface QueueMetrics {
  name: string;
  throughput: {
    completed: number;
    failed: number;
  };
}
