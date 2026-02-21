"use client";

import React, { useMemo, useState, useCallback } from "react";
import Plot from "react-plotly.js";
import type Plotly from "plotly.js";
import type { PlotMouseEvent } from "plotly.js";
import type { CourseAggregation } from "@/types";

interface HeatmapTabProps {
  courseAggregations: CourseAggregation[];
  mccTopicHeaders: string[];
  courses: string[];
}

export default function HeatmapTab({
  courseAggregations,
  mccTopicHeaders,
  courses,
}: HeatmapTabProps) {
  const [minOccurrences, setMinOccurrences] = useState(1);
  const [sortBy, setSortBy] = useState<string>("Total");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Compute total occurrences per topic across all courses
  const topicTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const topic of mccTopicHeaders) {
      totals[topic] = courseAggregations.reduce(
        (sum, ca) => sum + (ca.topicCounts[topic] || 0),
        0
      );
    }
    return totals;
  }, [courseAggregations, mccTopicHeaders]);

  // Filter topics based on the slider
  const filteredTopics = useMemo(
    () => mccTopicHeaders.filter((t) => topicTotals[t] >= minOccurrences),
    [mccTopicHeaders, topicTotals, minOccurrences]
  );

  // Sort filtered topics
  const sortedTopics = useMemo(() => {
    const sorted = [...filteredTopics];
    sorted.sort((a, b) => {
      let valA: number;
      let valB: number;

      if (sortBy === "Total") {
        valA = topicTotals[a] || 0;
        valB = topicTotals[b] || 0;
      } else {
        const agg = courseAggregations.find((ca) => ca.course === sortBy);
        valA = agg?.topicCounts[a] || 0;
        valB = agg?.topicCounts[b] || 0;
      }

      return sortDir === "desc" ? valB - valA : valA - valB;
    });
    return sorted;
  }, [filteredTopics, sortBy, sortDir, topicTotals, courseAggregations]);

  // X-axis labels: courses + "Total"
  const xLabels = useMemo(() => [...courses, "Total"], [courses]);

  // Build two separate Z matrices: one for courses, one for Total
  const { zCourses, zTotal, hoverCourses, hoverTotal, zMaxCourses, zMaxTotal } =
    useMemo(() => {
      const zC: (number | null)[][] = [];
      const zT: (number | null)[][] = [];
      const hC: string[][] = [];
      const hT: string[][] = [];
      let maxC = 0;
      let maxT = 0;

      for (const topic of sortedTopics) {
        const courseRow: (number | null)[] = [];
        const totalRow: (number | null)[] = [];
        const hoverCourseRow: string[] = [];
        const hoverTotalRow: string[] = [];
        let topicTotal = 0;

        for (const course of courses) {
          const agg = courseAggregations.find((ca) => ca.course === course);
          const count = agg?.topicCounts[topic] || 0;
          topicTotal += count;
          courseRow.push(count);
          totalRow.push(null); // null for Total trace in course columns
          if (count > maxC) maxC = count;
          hoverCourseRow.push(
            `<b>Course:</b> ${course}<br><b>Topic:</b> ${topic}<br><b>Count:</b> ${count}`
          );
          hoverTotalRow.push("");
        }

        // Total column: null for course trace, value for total trace
        courseRow.push(null);
        totalRow.push(topicTotal);
        if (topicTotal > maxT) maxT = topicTotal;
        hoverCourseRow.push("");
        hoverTotalRow.push(
          `<b>Total across all courses</b><br><b>Topic:</b> ${topic}<br><b>Count:</b> ${topicTotal}`
        );

        zC.push(courseRow);
        zT.push(totalRow);
        hC.push(hoverCourseRow);
        hT.push(hoverTotalRow);
      }

      return {
        zCourses: zC,
        zTotal: zT,
        hoverCourses: hC,
        hoverTotal: hT,
        zMaxCourses: maxC,
        zMaxTotal: maxT,
      };
    }, [sortedTopics, courses, courseAggregations]);

  const maxVal = useMemo(() => {
    let max = 0;
    for (const topic of mccTopicHeaders) {
      if (topicTotals[topic] > max) max = topicTotals[topic];
    }
    return max;
  }, [mccTopicHeaders, topicTotals]);

  // Click handler: clicking a heatmap cell sorts by that column
  const handleClick = useCallback(
    (event: Readonly<PlotMouseEvent>) => {
      if (event.points && event.points.length > 0) {
        const clickedX = event.points[0].x as string;
        if (clickedX === sortBy) {
          setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        } else {
          setSortBy(clickedX);
          setSortDir("desc");
        }
      }
    },
    [sortBy]
  );

  // Clickable annotations for x-axis labels (course names)
  const xAnnotations = useMemo(() => {
    return xLabels.map((label) => ({
      x: label,
      y: 1.0,
      xref: "x" as const,
      yref: "paper" as const,
      text:
        sortBy === label
          ? `<b>${label} ${sortDir === "desc" ? "▼" : "▲"}</b>`
          : label,
      showarrow: false,
      textangle: -45,
      font: {
        size: 11,
        color: sortBy === label ? "#4F2683" : "#444",
      },
      xanchor: "left" as const,
      yanchor: "bottom" as const,
      captureevents: true,
    }));
  }, [xLabels, sortBy, sortDir]);

  // Click handler for annotation (course label) clicks
  const handleAnnotationClick = useCallback(
    (event: { index: number }) => {
      const clickedLabel = xLabels[event.index];
      if (!clickedLabel) return;

      if (clickedLabel === sortBy) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setSortBy(clickedLabel);
        setSortDir("desc");
      }
    },
    [xLabels, sortBy]
  );

  const chartHeight = Math.max(400, sortedTopics.length * 18 + 180);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        {/* Sort controls */}
        <div className="flex items-center gap-3 text-sm text-western-text-body flex-wrap">
          <span className="whitespace-nowrap font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-western-purple/30"
          >
            <option value="Total">Total</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-western-text-body hover:bg-gray-200 transition-colors"
            title={sortDir === "desc" ? "Highest first" : "Lowest first"}
          >
            {sortDir === "desc" ? "▼ Highest first" : "▲ Lowest first"}
          </button>
          <span className="text-xs text-western-silver">
            (click course names or cells to sort)
          </span>
        </div>

        {/* Topic filter slider */}
        <label className="flex items-center gap-3 text-sm text-western-text-body">
          <span className="whitespace-nowrap font-medium">
            Min total occurrences:
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(maxVal, 1)}
            value={minOccurrences}
            onChange={(e) => setMinOccurrences(Number(e.target.value))}
            className="flex-1 accent-western-purple"
          />
          <span className="w-8 text-center font-semibold text-western-purple">
            {minOccurrences}
          </span>
        </label>
        <p className="text-xs text-western-silver">
          Showing {filteredTopics.length} of {mccTopicHeaders.length} topics
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        {sortedTopics.length === 0 ? (
          <div className="text-center py-20 text-western-silver">
            No topics match the current filter. Try lowering the minimum
            occurrences.
          </div>
        ) : (
          <Plot
            data={[
              // Trace 1: Individual courses (purple scale)
              {
                z: zCourses,
                x: xLabels,
                y: sortedTopics,
                type: "heatmap",
                colorscale: [
                  [0, "#F3EFF8"],
                  [0.25, "#C4B1DB"],
                  [0.5, "#9575BD"],
                  [0.75, "#6F3FA0"],
                  [1, "#4F2683"],
                ],
                zmin: 0,
                zmax: Math.max(zMaxCourses, 1),
                hoverinfo: "text",
                text: hoverCourses,
                hoverongaps: false,
                connectgaps: false,
                showscale: false,
              } as unknown as Partial<Plotly.PlotData>,
              // Trace 2: Total column (amber/gold scale)
              {
                z: zTotal,
                x: xLabels,
                y: sortedTopics,
                type: "heatmap",
                colorscale: [
                  [0, "#FFF8E8"],
                  [0.25, "#FCDBA0"],
                  [0.5, "#F0A830"],
                  [0.75, "#D4820A"],
                  [1, "#A85C00"],
                ],
                zmin: 0,
                zmax: Math.max(zMaxTotal, 1),
                hoverinfo: "text",
                text: hoverTotal,
                hoverongaps: false,
                connectgaps: false,
                showscale: false,
              } as unknown as Partial<Plotly.PlotData>,
            ]}
            layout={
              {
                xaxis: {
                  title: { text: "" },
                  showticklabels: false,
                  automargin: true,
                  side: "top",
                  dtick: 1,
                },
                yaxis: {
                  title: { text: "" },
                  automargin: true,
                  tickfont: { size: 10 },
                  autorange: "reversed",
                },
                annotations: xAnnotations,
                margin: { l: 250, r: 30, t: 160, b: 10 },
                height: chartHeight,
                paper_bgcolor: "white",
                plot_bgcolor: "white",
              } as Partial<Plotly.Layout>
            }
            config={{ responsive: true, displayModeBar: true }}
            style={{ width: "100%", height: chartHeight }}
            onClick={handleClick}
            onClickAnnotation={handleAnnotationClick}
          />
        )}
      </div>
    </div>
  );
}
