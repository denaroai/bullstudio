import type {
  JobCounts,
  AdapterCapabilities as QueueAdapterCapabilities,
} from "@bullstudio/connect-types";

export type QueueSourceStatus =
  | {
      mode: "standalone";
      source: "redis";
      status: "healthy" | "degraded" | "unavailable";
      connection: {
        host: string;
        port: string;
        hasPassword: boolean;
        database: string;
        displayUrl: string;
      };
      providers: string[];
      prefixes: string[];
      capabilities: {
        flows: boolean;
        schedulers: boolean;
        workers: boolean;
        supportedStatuses: string[];
        mutationsAllowed: boolean;
      };
    }
  | {
      mode: "embedded";
      source: "supplied";
      status: "healthy" | "degraded" | "unavailable";
      queueCount: number;
      providers: string[];
      capabilities: AdapterCapabilities & {
        mutationsAllowed: boolean;
      };
      readOnly: boolean;
      mutationsAllowed: boolean;
    };

export type AdapterCapabilities = QueueAdapterCapabilities;

export type DashboardQueue = {
  key?: string;
  name: string;
  label?: string;
  prefix?: string;
  provider?: string;
  isPaused?: boolean;
  jobCounts?: JobCounts;
  capabilities?: AdapterCapabilities;
};
