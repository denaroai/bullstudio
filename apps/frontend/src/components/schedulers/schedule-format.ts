import type { JobScheduler } from "@bullstudio/connect-types";

export function describeSchedule(scheduler: JobScheduler): string {
  if (scheduler.strategy === "cron") {
    return scheduler.pattern ?? "-";
  }
  return scheduler.every ? `every ${humanizeMs(scheduler.every)}` : "-";
}

export function humanizeMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${trimZero(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${trimZero(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${trimZero(hours)}h`;
  return `${trimZero(hours / 24)}d`;
}

function trimZero(value: number): string {
  return Number.parseFloat(value.toFixed(2)).toString();
}
