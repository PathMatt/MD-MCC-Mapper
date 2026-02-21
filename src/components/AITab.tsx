"use client";

import React, { useMemo, useState } from "react";
import Plot from "react-plotly.js";
import type Plotly from "plotly.js";
import { PCA } from "ml-pca";
import { kmeans } from "ml-kmeans";
import type { CourseAggregation } from "@/types";

interface AITabProps {
  courseAggregations: CourseAggregation[];
  mccTopicHeaders: string[];
  courses: string[];
}

// Western University–inspired palette for clusters
const CLUSTER_COLORS = [
  "#4F2683", // western purple
  "#0C8599", // muted teal
  "#82368C", // magenta-purple
  "#2B8A3E", // forest green
  "#E8590C", // burnt orange
  "#1971C2", // cobalt blue
  "#D4820A", // amber
  "#D6336C", // rose
];

export default function AITab({
  courseAggregations,
  mccTopicHeaders,
  courses,
}: AITabProps) {
  const [k, setK] = useState(5);
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);

  // ── Step 1: Build Topic × Course matrix & normalize ──────────────
  const topicData = useMemo(() => {
    // For each topic, get raw counts per course
    const rows: {
      topic: string;
      rawCounts: number[];
      totalFreq: number;
      normalized: number[];
    }[] = [];

    for (const topic of mccTopicHeaders) {
      const rawCounts = courses.map((course) => {
        const agg = courseAggregations.find((ca) => ca.course === course);
        return agg?.topicCounts[topic] || 0;
      });

      const totalFreq = rawCounts.reduce((s, v) => s + v, 0);

      // Skip topics with zero total (can't normalize)
      if (totalFreq === 0) continue;

      // Normalize row to proportions (course fingerprint)
      const normalized = rawCounts.map((c) => c / totalFreq);

      rows.push({ topic, rawCounts, totalFreq, normalized });
    }

    return rows;
  }, [courseAggregations, mccTopicHeaders, courses]);

  // ── Step 2: PCA + K-Means ────────────────────────────────────────
  const clusterResult = useMemo(() => {
    if (topicData.length < 3) return null;

    try {
      const X = topicData.map((t) => t.normalized);

      // PCA down to 2 components
      const pca = new PCA(X);
      const pcaData = pca.predict(X, { nComponents: 2 }).to2DArray();

      // K-Means clustering
      const effectiveK = Math.min(k, topicData.length);
      const result = kmeans(pcaData, effectiveK, {
        initialization: "kmeans++",
      });

      return {
        pcaData,
        clusters: result.clusters,
        effectiveK,
      };
    } catch (err) {
      console.error("Clustering error:", err);
      return null;
    }
  }, [topicData, k]);

  // ── Early returns ────────────────────────────────────────────────
  if (topicData.length < 3) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-western-silver">
        Not enough MCC topics with data to perform clustering. At least 3
        non-zero topics are required.
      </div>
    );
  }

  if (!clusterResult) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-western-silver">
        An error occurred during clustering. Please try adjusting K or check
        your data.
      </div>
    );
  }

  const { pcaData, clusters, effectiveK } = clusterResult;

  // ── Compute max frequency for dot sizing ─────────────────────────
  const maxFreq = Math.max(...topicData.map((t) => t.totalFreq));
  const minDot = 6;
  const maxDot = 28;

  function dotSize(freq: number): number {
    if (maxFreq <= 1) return minDot;
    return minDot + ((freq - 1) / (maxFreq - 1)) * (maxDot - minDot);
  }

  // ── Build scatter traces per cluster ─────────────────────────────
  const traces = Array.from({ length: effectiveK }, (_, clusterIdx) => {
    const indices = clusters
      .map((c, i) => (c === clusterIdx ? i : -1))
      .filter((i) => i !== -1);

    return {
      x: indices.map((i) => pcaData[i][0]),
      y: indices.map((i) => pcaData[i][1]),
      mode: "markers" as const,
      type: "scatter" as const,
      name: `Cluster ${clusterIdx + 1} (${indices.length})`,
      marker: {
        size: indices.map((i) => dotSize(topicData[i].totalFreq)),
        color: CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length],
        opacity: 0.85,
        line: { width: 1.5, color: "#FFFFFF" },
      },
      text: indices.map((i) => {
        const t = topicData[i];
        // Find top 2 courses by proportion
        const courseProportions = courses
          .map((c, ci) => ({ course: c, pct: t.normalized[ci] * 100 }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 2);

        const topCoursesStr = courseProportions
          .map((cp) => `${cp.course}: ${cp.pct.toFixed(0)}%`)
          .join("<br>");

        return `<b>${t.topic}</b><br>Cluster ${clusterIdx + 1}<br>Total frequency: ${t.totalFreq}<br>${topCoursesStr}`;
      }),
      hoverinfo: "text" as const,
    };
  });

  // ── Build cluster card data ──────────────────────────────────────
  const clusterCards = Array.from({ length: effectiveK }, (_, clusterIdx) => {
    const indices = clusters
      .map((c, i) => (c === clusterIdx ? i : -1))
      .filter((i) => i !== -1);

    const members = indices.map((i) => topicData[i]);

    // Compute dominant courses: average normalized proportions within cluster
    const avgProportions = courses.map((_, ci) => {
      if (members.length === 0) return 0;
      return (
        members.reduce((sum, m) => sum + m.normalized[ci], 0) / members.length
      );
    });

    // Top 2 dominant courses
    const dominantCourses = courses
      .map((c, ci) => ({ course: c, avg: avgProportions[ci] * 100 }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 2);

    return {
      clusterIdx,
      color: CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length],
      members,
      dominantCourses,
    };
  });

  return (
    <div className="space-y-4">
      {/* K slider */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <label className="flex items-center gap-3 text-sm text-western-text-body">
          <span className="whitespace-nowrap font-medium">
            Number of clusters (K):
          </span>
          <input
            type="range"
            min={3}
            max={8}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="flex-1 accent-western-purple"
          />
          <span className="w-8 text-center font-semibold text-western-purple">
            {k}
          </span>
        </label>
        <p className="text-xs text-western-silver mt-1">
          Clustering {topicData.length} MCC topics by course distribution
          fingerprint
          {mccTopicHeaders.length - topicData.length > 0 &&
            ` (${mccTopicHeaders.length - topicData.length} zero-frequency topics skipped)`}
        </p>
      </div>

      {/* Constellation scatter plot */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <Plot
          data={traces}
          layout={
            {
              title: {
                text: "MCC Topic Clusters by Course Distribution",
                font: { color: "#2F2E33", size: 16 },
              },
              xaxis: {
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                title: { text: "" },
              },
              yaxis: {
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                title: { text: "" },
              },
              height: 600,
              paper_bgcolor: "white",
              plot_bgcolor: "#FAFAFA",
              legend: {
                orientation: "h",
                y: -0.08,
                font: { size: 11, color: "#807F83" },
              },
              margin: { t: 60, b: 60, l: 40, r: 40 },
              hoverlabel: {
                bgcolor: "#2F2E33",
                font: { color: "#FFFFFF", size: 12 },
                bordercolor: "transparent",
              },
            } as Partial<Plotly.Layout>
          }
          config={{ responsive: true, displayModeBar: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Cluster cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clusterCards.map((card) => (
          <div
            key={card.clusterIdx}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* Card header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: `3px solid ${card.color}` }}
            >
              <div>
                <h4
                  className="text-sm font-semibold"
                  style={{ color: card.color }}
                >
                  Cluster {card.clusterIdx + 1}
                </h4>
                <p className="text-xs text-western-silver mt-0.5">
                  {card.dominantCourses
                    .map(
                      (dc) => `${dc.course} (${dc.avg.toFixed(0)}%)`
                    )
                    .join(" · ")}
                </p>
              </div>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: card.color + "18",
                  color: card.color,
                }}
              >
                {card.members.length} topic
                {card.members.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Topic pills */}
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {card.members
                  .sort((a, b) => b.totalFreq - a.totalFreq)
                  .slice(0, expandedCluster === card.clusterIdx ? undefined : 8)
                  .map((member) => (
                    <span
                      key={member.topic}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                      style={{
                        borderColor: card.color + "40",
                        color: "#2F2E33",
                        backgroundColor: card.color + "0A",
                      }}
                      title={`Total frequency: ${member.totalFreq}`}
                    >
                      {member.topic}
                      <span
                        className="text-[10px] opacity-60"
                      >
                        ({member.totalFreq})
                      </span>
                    </span>
                  ))}
              </div>
              {card.members.length > 8 && (
                <button
                  onClick={() =>
                    setExpandedCluster((prev) =>
                      prev === card.clusterIdx ? null : card.clusterIdx
                    )
                  }
                  className="text-xs mt-2 text-western-purple hover:underline"
                >
                  {expandedCluster === card.clusterIdx
                    ? "Show less"
                    : `+${card.members.length - 8} more topics`}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
