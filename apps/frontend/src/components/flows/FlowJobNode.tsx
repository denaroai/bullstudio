"use client";

import {
  getStatusColor,
  type JobStatus,
  JobStatusBadge,
} from "@bullstudio/ui/shared";
import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

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
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground"
      />

      <div
        className="w-60 cursor-pointer overflow-hidden rounded-md border bg-card shadow-lg transition-[border-color,box-shadow] hover:shadow-xl"
        style={{ borderColor: statusColor }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-3 py-2"
          style={{ backgroundColor: `${statusColor}15` }}
        >
          <JobStatusBadge status={nodeData.status} size="sm" showDot={false} />
          {nodeData.duration !== undefined && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatDuration(nodeData.duration)}
            </span>
          )}
        </div>

        <div className="space-y-1 px-3 py-2.5">
          <div className="font-medium text-sm text-foreground truncate">
            {nodeData.name}
          </div>

          <div className="text-xs text-muted-foreground font-mono truncate">
            {nodeData.queueName}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground"
      />
    </>
  );
}

export const FlowJobNode = memo(FlowJobNodeComponent);
