export type FlowListInput =
  | {
      queueKey?: string;
      queueName?: string;
      prefix?: string;
      limit?: number;
    }
  | undefined;

export type FlowTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  flowId: string;
};
