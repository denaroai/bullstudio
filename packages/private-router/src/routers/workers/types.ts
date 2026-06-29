export type WorkerListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  limit?: number;
};

export type WorkerTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  workerId: string;
};
