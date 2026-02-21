"use client";

import React, { useMemo, useState } from "react";
import Plot from "react-plotly.js";
import type Plotly from "plotly.js";
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

  // Build the Z matrix, hover text
  const { zData, hoverText } = useMemo(() => {
    const z: number[][] = [];
    const hover: string[][] = [];

    for (const topic of filteredTopics) {
      const row: number[] = [];
      const hoverRow: string[] = [];
      for (const course of courses) {
        const agg = courseAggregations.find((ca) => ca.course === course);
        const count = agg?.topicCounts[topic] || 0;
        row.push(count);
        hoverRow.push(
          `<b>Course:</b> ${course}<br><b>Topic:</b> ${topic}<br><b>Count:</b> ${count}`
        );
      }
      z.push(row);
      hover.push(hoverRow);
    }
    return { zData: z, hoverText: hover };
  }, [filteredTopics, courses, courseAggregations]);

  const maxVal = useMemo(() => {
    let max = 0;
    for (const topic of mccTopicHeaders) {
      if (topicTotals[topic] > max) max = topicTotals[topic];
    }
    return max;
  }, [mccTopicHeaders, topicTotals]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
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
        <p className="text-xs text-western-silver mt-1">
          Showing {filteredTopics.length} of {mccTopicHeaders.length} topics
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        {filteredTopics.length === 0 ? (
          <div className="text-center py-20 text-western-silver">
            No topics match the current filter. Try lowering the minimum
            occurrences.
          </div>
        ) : (
          <Plot
            data={[
              {
                z: zData,
                x: courses,
                y: filteredTopics,
                type: "heatmap",
                colorscale: [
                  [0, "#FFFFFF"],
                  [1, "#4F2683"],
                ],
                hoverinfo: "text",
                text: hoverText,
                showscale: true,
                colorbar: {
                  title: { text: "Count", side: "right" },
                },
              } as unknown as Partial<Plotly.PlotData>,
            ]}
            layout={
              {
                title: {
                  text: "MCC Topic Coverage by Course",
                  font: { color: "#2F2E33", size: 16 },
                },
                xaxis: {
                  title: { text: "Courses" },
                  tickangle: -45,
                  automargin: true,
                },
                yaxis: {
                  title: { text: "" },
                  automargin: true,
                  tickfont: { size: 10 },
                },
                margin: { l: 250, r: 80, t: 60, b: 120 },
                height: Math.max(500, filteredTopics.length * 18 + 200),
                paper_bgcolor: "white",
                plot_bgcolor: "white",
              } as Partial<Plotly.Layout>
            }
            config={{ responsive: true, displayModeBar: true }}
            style={{ width: "100%" }}
          />
        )}
      </div>
    </div>
  );
}
