import { BullMqProvider } from "../src/providers/bullmq";
import { BullProvider } from "../src/providers/bull";
import type { QueueServiceConfig } from "../src/types";
import { TEST_REDIS_URL } from "./redis";

type BullMqFn<T> = (provider: BullMqProvider) => Promise<T>;
type BullFn<T> = (provider: BullProvider) => Promise<T>;

function resolveConfig(
  config: Partial<QueueServiceConfig>,
): QueueServiceConfig {
  return {
    redisUrl: TEST_REDIS_URL,
    ...config,
  };
}

export async function withBullMqProvider<T>(
  config: Partial<QueueServiceConfig>,
  fn: BullMqFn<T>,
): Promise<T> {
  const provider = new BullMqProvider(resolveConfig(config));
  await provider.connect();
  try {
    return await fn(provider);
  } finally {
    await provider.disconnect().catch(() => {});
  }
}

export async function withBullProvider<T>(
  config: Partial<QueueServiceConfig>,
  fn: BullFn<T>,
): Promise<T> {
  const provider = new BullProvider(resolveConfig(config));
  await provider.connect();
  try {
    return await fn(provider);
  } finally {
    await provider.disconnect().catch(() => {});
  }
}
