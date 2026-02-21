"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { buildGraphData } from "@/utils/dataParser";
import type { CourseAggregation, GraphNode } from "@/types";

interface NetworkTabProps {
  courseAggregations: CourseAggregation[];
  mccTopicHeaders: string[];
  courses: string[];
}

export default function NetworkTab({
  courseAggregations,
  mccTopicHeaders,
  courses,
}: NetworkTabProps) {
  const [visibleCourses, setVisibleCourses] = useState<string[]>(courses);
  const containerRef = useRef<HTMLDivElement>(null);

  const graphData = useMemo(
    () =>
      buildGraphData(courseAggregations, mccTopicHeaders, visibleCourses),
    [courseAggregations, mccTopicHeaders, visibleCourses]
  );

  const toggleCourse = useCallback((course: string) => {
    setVisibleCourses((prev) =>
      prev.includes(course)
        ? prev.filter((c) => c !== course)
        : [...prev, course]
    );
  }, []);

  const selectAll = useCallback(() => setVisibleCourses(courses), [courses]);
  const selectNone = useCallback(() => setVisibleCourses([]), []);

  const nodeCanvasObject = useCallback(
    (
      node: GraphNode & { x?: number; y?: number },
      ctx: CanvasRenderingContext2D
    ) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const radius = node.group === 1 ? 8 : 4;

      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw label
      const label = node.name;
      const fontSize = node.group === 1 ? 11 : 8;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = node.group === 1 ? "#4F2683" : "#807F83";
      ctx.fillText(label, x + radius + 3, y);
    },
    []
  );

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
            linkWidth={(link: { value?: number }) =>
              Math.max(1, Math.min((link.value || 1) * 0.5, 6))
            }
            linkColor={() => "rgba(79, 38, 131, 0.15)"}
            width={800}
            height={600}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            backgroundColor="#FFFFFF"
          />
        )}
      </div>
    </div>
  );
}
