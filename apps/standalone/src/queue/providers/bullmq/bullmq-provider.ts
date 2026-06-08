import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import type {
  Queue as IQueue,
  Job,
  JobCounts,
  JobQueryOptions,
  JobSummary,
  QueueAdapter,
  WorkerCount,
} from "@bullstudio/connect-types";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { discoverPrefixes } from "../../detection/prefix-discovery";
import { NotConnectedError } from "../../errors";
import type {
  QueueProviderCapabilities,
  QueueProviderType,
  QueueService,
  QueueServiceConfig,
  QueueServiceEventCallbacks,
} from "../../types";
import { getProviderCapabilities } from "../../types";

const DEFAULT_PREFIX = "bull";

export class BullMqProvider implements QueueService {
  readonly providerType: QueueProviderType = "bullmq";

  private readonly config: QueueServiceConfig;
  private readonly eventCallbacks: QueueServiceEventCallbacks;
  private connection: Redis | null = null;
  private queues = new Map<string, Queue>();
  private queueAdapters = new Map<string, QueueAdapter>();
  private _isConnected = false;
  private _isReconnecting = false;

  constructor(config: QueueServiceConfig) {
    this.config = {
      prefix: DEFAULT_PREFIX,
      ...config,
    };
    this.eventCallbacks = config.eventCallbacks ?? {};
  }

  private resolvedPrefixes: string[] | null = null;

  private queueKey(prefix: string, name: string): string {
    return `${prefix}\0${name}`;
  }

  private get defaultPrefix(): string {
    if (this.config.prefix) {
      return this.config.prefix;
    }
    const explicit = this.config.prefixes?.filter((p) => p !== "*");
    if (explicit?.length === 1) {
      const [prefix] = explicit;
      return prefix ?? DEFAULT_PREFIX;
    }
    return DEFAULT_PREFIX;
  }

  private async getActivePrefixes(): Promise<string[]> {
    if (this.resolvedPrefixes) {
      return this.resolvedPrefixes;
    }
    const explicit = this.config.prefixes;
    if (explicit && explicit.length > 0 && !explicit.includes("*")) {
      this.resolvedPrefixes = explicit;
      return explicit;
    }
    if (explicit?.includes("*") && this.connection) {
      const found = await discoverPrefixes(this.connection);
      this.resolvedPrefixes = found.length > 0 ? found : [this.defaultPrefix];
      return this.resolvedPrefixes;
    }
    this.resolvedPrefixes = [this.defaultPrefix];
    return this.resolvedPrefixes;
  }

  getCapabilities(): QueueProviderCapabilities {
    return getProviderCapabilities("bullmq");
  }

  async connect(): Promise<void> {
    if (this._isConnected) {
      return;
    }

    this.connection = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      // Disable ioredis built-in retry - we handle it ourselves
      retryStrategy: () => null,
    });

    this.setupEventListeners();

    try {
      await this.connection.connect();
      await this.connection.ping();
      this._isConnected = true;
    } catch (error) {
      // Cleanup on failure
      if (this.connection) {
        await this.connection.quit().catch(() => {});
        this.connection = null;
      }
      this._isConnected = false;
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.connection) return;

    // Handle errors - this prevents unhandled error events
    this.connection.on("error", (error: Error) => {
      console.error("[BullMqProvider] Redis error:", error.message);
      if (this._isConnected && !this._isReconnecting) {
        this._isConnected = false;
        this.eventCallbacks.onError?.(error);
      }
    });

    // Handle connection close
    this.connection.on("close", () => {
      console.log("[BullMqProvider] Redis connection closed");
      if (this._isConnected && !this._isReconnecting) {
        this._isConnected = false;
        this.eventCallbacks.onDisconnect?.("Connection closed");
      }
    });

    // Handle end (connection fully terminated)
    this.connection.on("end", () => {
      console.log("[BullMqProvider] Redis connection ended");
      if (this._isConnected) {
        this._isConnected = false;
        this.eventCallbacks.onDisconnect?.("Connection ended");
      }
    });

    // Handle reconnecting (ioredis internal reconnection)
    this.connection.on("reconnecting", () => {
      console.log("[BullMqProvider] Redis reconnecting...");
      this._isReconnecting = true;
      this.eventCallbacks.onReconnecting?.();
    });

    // Handle ready (reconnected)
    this.connection.on("ready", () => {
      console.log("[BullMqProvider] Redis ready");
      if (this._isReconnecting) {
        this._isReconnecting = false;
        this._isConnected = true;
        this.eventCallbacks.onReconnected?.();
      }
    });
  }

  async disconnect(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close(),
    );
    await Promise.all(closePromises);
    this.queues.clear();
    this.queueAdapters.clear();

    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }

    this._isConnected = false;
  }

  isConnected(): boolean {
    return this._isConnected && this.connection?.status === "ready";
  }

  async getPrefixes(): Promise<string[]> {
    return this.getActivePrefixes();
  }

  async getQueues(): Promise<IQueue[]> {
    const discovered = await this.discoverQueues();
    const queues = await Promise.all(
      discovered.map((q) => this.getQueue(q.name, q.prefix)),
    );
    return queues.filter((q): q is IQueue => q !== null);
  }

  async getQueue(name: string, prefix?: string): Promise<IQueue | null> {
    return this.getOrCreateQueueAdapter(name, prefix).getQueue();
  }

  async getJobCounts(queueName: string, prefix?: string): Promise<JobCounts> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJobCounts();
  }

  async pauseQueue(queueName: string, prefix?: string): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).pauseQueue();
  }

  async resumeQueue(queueName: string, prefix?: string): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).resumeQueue();
  }

  async drainQueue(queueName: string, prefix?: string): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).drainQueue();
  }

  async getJobs(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<Job[]> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJobs(options);
  }

  async getJobsSummary(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<JobSummary[]> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJobsSummary(
      options,
    );
  }

  async getJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<Job | null> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJob(jobId);
  }

  async getJobLogs(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<{ logs: string[]; count: number }> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJobLogs(jobId);
  }

  async retryJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).retryJob(jobId);
  }

  async removeJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).removeJob(jobId);
  }

  async getWorkerCount(
    queueName: string,
    prefix?: string,
  ): Promise<WorkerCount> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getWorkerCount();
  }

  private getOrCreateQueueAdapter(name: string, prefix?: string): QueueAdapter {
    const pfx = prefix ?? this.defaultPrefix;
    const key = this.queueKey(pfx, name);
    let adapter = this.queueAdapters.get(key);
    if (!adapter) {
      adapter = createBullMqQueueAdapter(this.getOrCreateQueue(name, pfx), {
        key,
        label: name,
      });
      this.queueAdapters.set(key, adapter);
    }
    return adapter;
  }

  private getOrCreateQueue(name: string, prefix: string): Queue {
    const key = this.queueKey(prefix, name);
    let queue = this.queues.get(key);
    if (!queue) {
      if (!this.connection) {
        throw new NotConnectedError();
      }
      queue = new Queue(name, {
        connection: this.connection,
        prefix,
      });
      this.queues.set(key, queue);
    }
    return queue;
  }

  private async discoverQueues(): Promise<{ name: string; prefix: string }[]> {
    if (!this.connection) {
      throw new NotConnectedError();
    }

    const prefixes = await this.getActivePrefixes();
    const result: { name: string; prefix: string }[] = [];
    const seen = new Set<string>();

    for (const prefix of prefixes) {
      const pattern = `${prefix}:*:meta`;
      let cursor = "0";
      do {
        const [next, keys] = await this.connection.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = next;
        for (const key of keys) {
          const parts = key.split(":");
          const name = parts[1] ?? "";
          if (!name) continue;
          const composite = this.queueKey(prefix, name);
          if (seen.has(composite)) continue;
          seen.add(composite);
          result.push({ name, prefix });
        }
      } while (cursor !== "0");
    }

    return result;
  }
}
