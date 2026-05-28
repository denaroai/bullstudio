export interface FlowDetailNavigationSource {
  queueName: string;
  prefix?: string;
  queueKey?: string;
}

export function getFlowDetailSearch(flow: FlowDetailNavigationSource) {
  return {
    ...(flow.queueKey ? { queueKey: flow.queueKey } : {}),
    queueName: flow.queueName,
    prefix: flow.prefix,
  };
}
