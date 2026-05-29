import type { ConnectionConfig } from "../types";

/**
 * Builds a Redis URL from connection configuration.
 */
export function buildRedisUrl(config: ConnectionConfig): string {
  const { host, port, database, username, password, tls } = config;

  const protocol = tls ? "rediss" : "redis";
  let auth = "";

  if (username && password) {
    auth = `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
  } else if (password) {
    auth = `:${encodeURIComponent(password)}@`;
  }

  return `${protocol}://${auth}${host}:${port}/${database}`;
}
