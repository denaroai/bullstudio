"use client";

import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { FlowJobNode, type FlowJobNodeData } from "./FlowJobNode";
import { getStatusColor, type JobStatus } from "@bullstudio/ui/shared";
import type { FlowNode as FlowNodeType } from "@bullstudio/connect-types";

const nodeTypes = {
  flowJob: FlowJobNode,
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;

interface FlowGraphProps {
  root: FlowNodeType;
  onNodeClick: (jobId: string, queueName: string) => void;
}

function buildNodesAndEdges(root: FlowNodeType): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function traverse(node: FlowNodeType, parentId?: string) {
    const duration =
      node.finishedOn && node.processedOn
        ? node.finishedOn - node.processedOn
        : undefined;

    nodes.push({
      id: node.id,
      type: "flowJob",
      position: { x: 0, y: 0 },
      data: {
        name: node.name,
        status: node.status,
        queueName: node.queueName,
        duration,
      } as FlowJobNodeData,
    });

    if (parentId) {
      const isActive =
        node.status === "active" || node.status === "waiting";
      const statusColor = getStatusColor(node.status as JobStatus);

      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: "smoothstep",
        animated: isActive,
        style: {
          stroke: statusColor,
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: statusColor,
          width: 20,
          height: 20,
        },
      });
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child, node.id);
      }
    }
  }

  traverse(root);
  return { nodes, edges };
}

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction = "TB"
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 100,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}


export function FlowGraph({ root, onNodeClick }: FlowGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const { nodes, edges } = buildNodesAndEdges(root);
    return getLayoutedElements(nodes, edges);
  }, [root]);

  const [nodes, setNodes , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const nodeData = node.data as FlowJobNodeData;
      onNodeClick(node.id, nodeData.queueName);
    },
    [onNodeClick]
  );

  useEffect(() => {
    const { nodes, edges } = buildNodesAndEdges(root);
    const { nodes: layoutedNodes, edges: layoutedEdges } =  getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [root, setNodes, setEdges]); 

  return (
    <div className="h-[600px] rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={20}
          size={1}
          color="#27272a"
          className="bg-zinc-950"
        />
        <Controls
          showInteractive={false}
          className="!bg-zinc-900 !border-zinc-800 !rounded-lg !shadow-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700"
        />
      </ReactFlow>
    </div>
  );
}
