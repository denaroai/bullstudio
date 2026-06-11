/**
 * Reconnect backoff for a provider's long-lived Redis connection.
 *
 * ioredis only consults `retryStrategy` from its close handler — i.e. after a
 * previously established connection drops. The initial `connect()` attempt still
 * fails fast and rejects, so returning a number here enables self-healing
 * reconnection on outages without making startup hang. The delay grows with the
 * attempt count and is capped so a prolonged Redis outage is retried
 * indefinitely without hammering the server.
 */
export function redisReconnectStrategy(attempt: number): number {
  return Math.min(attempt * 200, 5000);
}
