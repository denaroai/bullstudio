export type SchedulerListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  limit?: number;
};

export type SchedulerTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  schedulerKey: string;
  schedulerId?: string;
};

export type SchedulerUpsertInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  schedulerId: string;
  previousKey?: string;
  repeat: {
    strategy: "cron" | "every";
    pattern?: string;
    every?: number;
    tz?: string;
    endDate?: number;
    limit?: number;
  };
  template?: {
    name?: string;
    data?: unknown;
    opts?: Record<string, unknown>;
  };
};

export type SchedulerMutationResponse = {
  success: true;
  message: string;
};
