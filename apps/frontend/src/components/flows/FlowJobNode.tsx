"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  JobStatusBadge,
  type JobStatus,
  getStatusColor,
} from "@bullstudio/ui/shared";

export interface FlowJobNodeData {
  name: string;
  status: JobStatus;
  queueName: string;
  duration?: number;
  [key: string]: unknown;
}

interface FlowJobNodeProps {
  data: FlowJobNodeData;
}

function FlowJobNodeComponent({ data }: FlowJobNodeProps) {
  const nodeData = data;
  const statusColor = getStatusColor(nodeData.status);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-zinc-700 !border-2 !border-zinc-600"
      />

      <div
        className="min-w-[200px] bg-zinc-900 rounded-lg border-2 overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
        style={{ borderColor: statusColor }}
      >
        <div
          className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800"
          style={{ backgroundColor: `${statusColor}15` }}
        >
          <JobStatusBadge status={nodeData.status} size="sm" showDot={false} />
        </div>

        <div className="p-3 space-y-1.5">
          <div className="font-medium text-sm text-zinc-100 truncate">
            {nodeData.name}
          </div>

          <div className="text-xs text-zinc-500 font-mono truncate">
            {nodeData.queueName}
          </div>

          {nodeData.duration !== undefined && (
            <div className="text-xs text-zinc-400 font-mono">
              {formatDuration(nodeData.duration)}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-zinc-700 !border-2 !border-zinc-600"
      />
    </>
  );
}

export const FlowJobNode = memo(FlowJobNodeComponent);
