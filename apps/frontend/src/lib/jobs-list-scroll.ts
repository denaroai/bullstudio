import type { FilterableStatus, JobSortField } from "@/lib/jobs";

export function jobsListScrollStorageKey(parts: {
  queueParam: string;
  statusFilter: FilterableStatus;
  q?: string;
  page: number;
  pageSize: number;
  sortField: JobSortField;
  sortOrder: "asc" | "desc";
}): string {
  return `bullstudio:queue-jobs-scroll:${JSON.stringify({
    queue: parts.queueParam,
    status: parts.statusFilter,
    q: parts.q?.trim() ?? "",
    page: parts.page,
    pageSize: parts.pageSize,
    sort: parts.sortField,
    order: parts.sortOrder,
  })}`;
}

export function readJobsListScrollY(storageKey: string): number | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw == null) return null;
    const y = Number.parseInt(raw, 10);
    return Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

export function writeJobsListScrollY(storageKey: string, y: number): void {
  try {
    sessionStorage.setItem(storageKey, String(Math.round(y)));
  } catch {
    // private mode / quota
  }
}
