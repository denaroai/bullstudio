/**
 * Normalized job scheduler shared across providers.
 *
 * Maps both BullMQ "job schedulers" (`getJobSchedulers`) and Bull
 * "repeatable jobs" (`getRepeatableJobs`) onto a single shape so the
 * dashboard can present and manage them uniformly.
 */

export type SchedulerRepeatStrategy = "cron" | "every";

export interface JobSchedulerTemplate {
  data?: unknown;
  opts?: Record<string, unknown>;
}

export interface JobScheduler {
  /** Stable Redis key identifying the scheduler within its queue. */
  key: string;
  /**
   * Scheduler id. For BullMQ this is the `schedulerId` used to manage the
   * scheduler; for Bull it mirrors the repeatable job id when one was set.
   */
  id?: string;
  /** Name of the jobs produced by this scheduler. */
  name: string;
  queueName: string;
  prefix?: string;
  /** Repeat strategy derived from the configured options. */
  strategy: SchedulerRepeatStrategy;
  /** Cron expression, present when {@link strategy} is `"cron"`. */
  pattern?: string;
  /** Interval in milliseconds, present when {@link strategy} is `"every"`. */
  every?: number;
  /** Timezone used to evaluate the cron pattern. */
  tz?: string;
  /** Timestamp of the next scheduled execution. */
  next?: number;
  /** Timestamp after which the scheduler stops producing jobs. */
  endDate?: number;
  /** Maximum number of jobs the scheduler will produce. */
  limit?: number;
  /** Job template. Only available for BullMQ job schedulers. */
  template?: JobSchedulerTemplate;
}

export interface JobSchedulerRepeat {
  strategy: SchedulerRepeatStrategy;
  /** Cron expression, required when {@link strategy} is `"cron"`. */
  pattern?: string;
  /** Interval in milliseconds, required when {@link strategy} is `"every"`. */
  every?: number;
  tz?: string;
  endDate?: number;
  limit?: number;
}

export interface UpsertJobSchedulerInput {
  /** Scheduler id to create or update. */
  schedulerId: string;
  /**
   * Existing scheduler key being replaced. Used by providers without a native
   * upsert (Bull) to remove the previous repeatable before adding the new one.
   */
  previousKey?: string;
  repeat: JobSchedulerRepeat;
  template?: {
    name?: string;
    data?: unknown;
    opts?: Record<string, unknown>;
  };
}

/** Identifies a single scheduler for read or delete operations. */
export interface JobSchedulerTarget {
  key: string;
  id?: string;
}
