export interface RetryStrategyConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor?: number;
}

export class RetryStrategy {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterFactor: number;

  constructor(config: RetryStrategyConfig) {
    this.maxAttempts = config.maxAttempts;
    this.baseDelayMs = config.baseDelayMs;
    this.maxDelayMs = config.maxDelayMs;
    this.jitterFactor = config.jitterFactor ?? 0.1;
  }

  shouldRetry(attempts: number): boolean {
    return attempts < this.maxAttempts;
  }

  getDelay(attempts: number): number {
    // Exponential backoff: baseDelay * 2^attempts
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempts);
    const clampedDelay = Math.min(exponentialDelay, this.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter =
      clampedDelay * this.jitterFactor * (Math.random() * 2 - 1);

    return Math.floor(clampedDelay + jitter);
  }
}
