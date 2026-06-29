export interface Worker {
  id: string;
  name: string;
  queueName: string;
  prefix?: string;
  queueKey?: string;
  provider?: string;
  address?: string;
  age: number;
  idle: number;
  metadata: Record<string, string>;
}

export interface WorkerCount {
  queueName: string;
  count: number;
}
