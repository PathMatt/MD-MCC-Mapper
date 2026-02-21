"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import { buildGraphData } from "@/utils/dataParser";
import type { CourseAggregation, GraphNode, GraphLink } from "@/types";

interface NetworkTabProps {
  courseAggregations: CourseAggregation[];
  mccTopicHeaders: string[];
  courses: string[];
}

// After d3 simulation, source/target become objects
interface SimLink extends GraphLink {
  source: string | { id: string };
  target: string | { id: string };
}

function getLinkSourceId(link: SimLink): string {
  return typeof link.source === "object" ? link.source.id : link.source;
}
function getLinkTargetId(link: SimLink): string {
  return typeof link.target === "object" ? link.target.id : link.target;
}

export default function NetworkTab({
  courseAggregations,
  mccTopicHeaders,
  courses,
}: NetworkTabProps) {
  const [visibleCourses, setVisibleCourses] = useState<string[]>(courses);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  const graphData = useMemo(
    () =>
      buildGraphData(courseAggregations, mccTopicHeaders, visibleCourses),
    [courseAggregations, mccTopicHeaders, visibleCourses]
  );

  // Compute which nodes and links to highlight when a node is focused
  const highlightNodes = useMemo(() => {
    if (!focusedNode) return null; // null = show all
    const nodes = new Set<string>([focusedNode]);
    for (const link of graphData.links as SimLink[]) {
      const srcId = getLinkSourceId(link);
      const tgtId = getLinkTargetId(link);
      if (srcId === focusedNode || tgtId === focusedNode) {
        nodes.add(srcId);
        nodes.add(tgtId);
      }
    }
    return nodes;
  }, [focusedNode, graphData.links]);

  // Configure d3 forces for better spacing
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-300);
    fg.d3Force("link")?.distance(120);
    fg.d3Force("center")?.strength(0.05);
  }, [graphData]);

  // Clear focus when graph data changes (course filter toggled)
  useEffect(() => {
    setFocusedNode(null);
  }, [graphData]);

  const toggleCourse = useCallback((course: string) => {
    setVisibleCourses((prev) =>
      prev.includes(course)
        ? prev.filter((c) => c !== course)
        : [...prev, course]
    );
  }, []);

  const selectAll = useCallback(() => setVisibleCourses(courses), [courses]);
  const selectNone = useCallback(() => setVisibleCourses([]), []);

  const handleZoom = useCallback(
    (transform: { k: number; x: number; y: number }) => {
      setZoomLevel(transform.k);
    },
    []
  );

  // Click a node to focus; click same node again to clear
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setFocusedNode((prev) => (prev === node.id ? null : node.id));
    },
    []
  );

  // Click background to clear focus
  const handleBackgroundClick = useCallback(() => {
    setFocusedNode(null);
  }, []);

  const nodeCanvasObject = useCallback(
    (
      node: GraphNode & { x?: number; y?: number },
      ctx: CanvasRenderingContext2D
    ) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const isCourse = node.group === 1;
      const radius = isCourse ? 8 : 4;

      // Determine if this node is dimmed
      const isDimmed = highlightNodes !== null && !highlightNodes.has(node.id);
      const isHighlighted =
        highlightNodes !== null && highlightNodes.has(node.id);
      const isFocusedSelf = focusedNode === node.id;

      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, isFocusedSelf ? radius + 2 : radius, 0, 2 * Math.PI);
      ctx.globalAlpha = isDimmed ? 0.08 : 1;
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = isFocusedSelf ? "#F0A830" : "#FFFFFF";
      ctx.lineWidth = isFocusedSelf ? 2 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw label
      const showTopicLabels = zoomLevel >= 1.8;
      // When focused, always show labels for highlighted nodes
      const showFocusedLabels = isHighlighted;

      if (isDimmed) {
        // No label for dimmed nodes
        return;
      }

      if (isCourse) {
        const fontSize = 12;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#4F2683";
        ctx.fillText(node.name, x + radius + 4, y);
      } else if (showTopicLabels || showFocusedLabels) {
        const fontSize =
          showFocusedLabels && !showTopicLabels
            ? 5
            : Math.min(6, 4 + zoomLevel * 0.8);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#807F83";
        ctx.fillText(node.name, x + radius + 2, y);
      }
    },
    [zoomLevel, highlightNodes, focusedNode]
  );

  // Dynamic link color: dim links not connected to focused node
  const linkColorFn = useCallback(
    (link: SimLink) => {
      if (!focusedNode) return "rgba(79, 38, 131, 0.12)";
      const srcId = getLinkSourceId(link);
      const tgtId = getLinkTargetId(link);
      if (srcId === focusedNode || tgtId === focusedNode) {
        return "rgba(79, 38, 131, 0.5)";
      }
      return "rgba(79, 38, 131, 0.02)";
    },
    [focusedNode]
  );

  // Dynamic link width: emphasize focused links
  const linkWidthFn = useCallback(
    (link: SimLink & { value?: number }) => {
      const base = Math.max(1, Math.min((link.value || 1) * 0.5, 6));
      if (!focusedNode) return base;
      const srcId = getLinkSourceId(link);
      const tgtId = getLinkTargetId(link);
      if (srcId === focusedNode || tgtId === focusedNode) {
        return base * 1.5;
      }
      return 0.5;
    },
    [focusedNode]
  );

  // Info about focused node
  const focusedInfo = useMemo(() => {
    if (!focusedNode) return null;
    const node = graphData.nodes.find((n) => n.id === focusedNode);
    if (!node) return null;
    const connectedCount = highlightNodes ? highlightNodes.size - 1 : 0;
    return { name: node.name, group: node.group, connections: connectedCount };
  }, [focusedNode, graphData.nodes, highlightNodes]);

  return (
    <div className="flex gap-4">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-4 max-h-[700px] overflow-y-auto">
        <h3 className="text-sm font-semibold text-western-text-header mb-3">
          Filter Courses
        </h3>
        <div className="flex gap-2 mb-3">
          <button
            onClick={selectAll}
            className="text-xs px-2 py-1 bg-western-purple text-white rounded hover:bg-western-purple-secondary transition-colors"
          >
            All
          </button>
          <button
            onClick={selectNone}
            className="text-xs px-2 py-1 bg-western-silver text-white rounded hover:bg-gray-500 transition-colors"
          >
            None
          </button>
        </div>
        <div className="space-y-1">
          {courses.map((course) => (
            <label
              key={course}
              className="flex items-center gap-2 text-xs text-western-text-body cursor-pointer hover:bg-gray-50 p-1 rounded"
            >
              <input
                type="checkbox"
                checked={visibleCourses.includes(course)}
                onChange={() => toggleCourse(course)}
                className="accent-western-purple"
              />
              <span className="truncate" title={course}>
                {course}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
          {focusedInfo ? (
            <>
              <p className="text-xs font-semibold text-western-purple">
                {focusedInfo.name}
              </p>
              <p className="text-xs text-western-silver">
                {focusedInfo.group === 1 ? "Course" : "MCC Topic"} &middot;{" "}
                {focusedInfo.connections} connection
                {focusedInfo.connections !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => setFocusedNode(null)}
                className="text-xs px-2 py-1 bg-gray-100 text-western-text-body rounded hover:bg-gray-200 transition-colors mt-1"
              >
                Clear selection
              </button>
            </>
          ) : (
            <p className="text-xs text-western-silver">
              Click a node to isolate its connections. Zoom in to see topic
              labels.
            </p>
          )}
        </div>
      </div>

      {/* Graph */}
      <div
        ref={containerRef}
        className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        style={{ minHeight: 600 }}
      >
        {graphData.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-western-silver">
            Select at least one course to view the network.
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeId="id"
            nodeCanvasObject={nodeCanvasObject as never}
            nodePointerAreaPaint={(
              node: GraphNode & { x?: number; y?: number },
              color: string,
              ctx: CanvasRenderingContext2D
            ) => {
              const x = node.x ?? 0;
              const y = node.y ?? 0;
              const radius = node.group === 1 ? 8 : 4;
              ctx.beginPath();
              ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkWidth={linkWidthFn as never}
            linkColor={linkColorFn as never}
            width={800}
            height={600}
            cooldownTicks={200}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.25}
            backgroundColor="#FFFFFF"
            onZoom={handleZoom}
            onNodeClick={handleNodeClick as never}
            onBackgroundClick={handleBackgroundClick}
            nodeLabel={(node: GraphNode) =>
              `<b>${node.name}</b>${node.group === 2 ? " (MCC Topic)" : " (Course)"}`
            }
          />
        )}
      </div>
    </div>
  );
}
