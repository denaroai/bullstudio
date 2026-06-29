import {
  createJobNotFoundError,
  createWorkerCount,
  filterJobsByName,
  mapRedisClientWorker,
  normalizeJobCounts,
  sortJobs,
  toJobSummary,
} from "@bullstudio/adapter-utils";
import type { Job } from "@bullstudio/connect-types";
import { describe, expect, it } from "vitest";

describe("adapter utils", () => {
  it("filters jobs by exact name when a name is supplied", () => {
    expect(
      filterJobsByName(
        [
          { name: "welcome", id: "1" },
          { name: "digest", id: "2" },
          { name: "welcome", id: "3" },
        ],
        "welcome",
      ),
    ).toEqual([
      { name: "welcome", id: "1" },
      { name: "welcome", id: "3" },
    ]);
  });

  it("sorts jobs by numeric fields and treats non-numeric progress as zero", () => {
    expect(
      sortJobs(
        [
          createJob({ id: "1", timestamp: 20, progress: { current: 10 } }),
          createJob({ id: "2", timestamp: 10, progress: 50 }),
          createJob({ id: "3", timestamp: 30, progress: 10 }),
        ],
        "progress",
        "desc",
      ).map((job) => job.id),
    ).toEqual(["2", "3", "1"]);
  });

  it("converts full jobs to summaries without heavy payload fields", () => {
    expect(toJobSummary(createJob({ id: "1" }))).toEqual({
      id: "1",
      name: "welcome",
      queueName: "email",
      status: "waiting",
      progress: 0,
      attemptsMade: 0,
      timestamp: 100,
      processedOn: undefined,
      finishedOn: undefined,
      delay: undefined,
      priority: undefined,
      parentId: undefined,
      repeatJobKey: undefined,
      failedReason: undefined,
    });
  });

  it("normalizes missing job count fields to zero", () => {
    expect(
      normalizeJobCounts({
        waiting: 1,
        "waiting-children": 2,
      }),
    ).toEqual({
      waiting: 1,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      prioritized: 0,
      waitingChildren: 2,
    });
  });

  it("builds shared worker counts and missing-job errors", () => {
    expect(createWorkerCount("email", [{}, {}])).toEqual({
      queueName: "email",
      count: 2,
    });
    expect(createJobNotFoundError("email", "1").message).toBe(
      'Job "1" was not found in queue "email".',
    );
  });

  it("maps Redis client records to worker metadata", () => {
    expect(
      mapRedisClientWorker(
        {
          id: "12",
          name: "worker-a",
          addr: "127.0.0.1:6379",
          age: "20",
          idle: 3,
          flags: "N",
          db: 0,
          nested: { ignored: true },
        },
        "email",
        { prefix: "bull", provider: "bullmq" },
      ),
    ).toEqual({
      id: "bull:email:worker-a:127.0.0.1:6379",
      name: "worker-a",
      queueName: "email",
      prefix: "bull",
      provider: "bullmq",
      address: "127.0.0.1:6379",
      age: 20,
      idle: 3,
      metadata: {
        id: "12",
        name: "worker-a",
        addr: "127.0.0.1:6379",
        age: "20",
        idle: "3",
        flags: "N",
        db: "0",
      },
    });
  });
});

function createJob(overrides: Partial<Job>): Job {
  return {
    id: "1",
    name: "welcome",
    queueName: "email",
    data: { userId: 123 },
    status: "waiting",
    progress: 0,
    attemptsMade: 0,
    attemptsLimit: 1,
    failedReason: undefined,
    stacktrace: [],
    returnValue: { ok: true },
    timestamp: 100,
    processedOn: undefined,
    finishedOn: undefined,
    delay: undefined,
    priority: undefined,
    parentId: undefined,
    repeatJobKey: undefined,
    ...overrides,
  };
}
