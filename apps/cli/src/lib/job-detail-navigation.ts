export interface JobDetailNavigationSource {
  queueName: string;
  prefix?: string;
  queueKey?: string;
}

export function getJobDetailSearch(job: JobDetailNavigationSource) {
  return {
    ...(job.queueKey ? { queueKey: job.queueKey } : {}),
    queueName: job.queueName,
    prefix: job.prefix,
  };
}
