"use client";

import React, { useMemo, useState } from "react";
import Plot from "react-plotly.js";
import type Plotly from "plotly.js";
import { PCA } from "ml-pca";
import { kmeans } from "ml-kmeans";
import type { OutcomeRow } from "@/types";

interface AITabProps {
  outcomes: OutcomeRow[];
}

// Visually distinct colors for up to 10 clusters
const CLUSTER_COLORS = [
  "#4F2683", // purple
  "#E8590C", // orange-red
  "#2B8A3E", // green
  "#1971C2", // blue
  "#E64980", // pink
  "#0C8599", // teal
  "#E67700", // amber
  "#862E9C", // violet
  "#5C940D", // lime green
  "#D6336C", // rose
];

const CLUSTER_LABELS = [
  "Cluster 1",
  "Cluster 2",
  "Cluster 3",
  "Cluster 4",
  "Cluster 5",
  "Cluster 6",
  "Cluster 7",
  "Cluster 8",
  "Cluster 9",
  "Cluster 10",
];

export default function AITab({ outcomes }: AITabProps) {
  const [k, setK] = useState(5);
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);

  // Filter out outcomes with all-zero vectors
  const validOutcomes = useMemo(
    () => outcomes.filter((o) => o.mccVector.some((v) => v === 1)),
    [outcomes]
  );

  const clusterResult = useMemo(() => {
    if (validOutcomes.length < 3) return null;

    try {
      const X = validOutcomes.map((o) => o.mccVector);

      // PCA down to 2 components
      const pca = new PCA(X);
      const pcaData = pca.predict(X, { nComponents: 2 }).to2DArray();

      // KMeans clustering
      const effectiveK = Math.min(k, validOutcomes.length);
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
  }, [validOutcomes, k]);

  if (validOutcomes.length < 3) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-western-silver">
        Not enough outcomes with MCC topic mappings to perform clustering.
        At least 3 non-zero outcomes are required.
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

  // Build traces per cluster for scatter plot
  const traces = Array.from({ length: effectiveK }, (_, clusterIdx) => {
    const indices = clusters
      .map((c, i) => (c === clusterIdx ? i : -1))
      .filter((i) => i !== -1);

    return {
      x: indices.map((i) => pcaData[i][0]),
      y: indices.map((i) => pcaData[i][1]),
      mode: "markers" as const,
      type: "scatter" as const,
      name: `${CLUSTER_LABELS[clusterIdx]} (${indices.length})`,
      marker: {
        size: 10,
        color: CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length],
        opacity: 0.85,
        line: { width: 1.5, color: "#FFFFFF" },
      },
      text: indices.map((i) => {
        const o = validOutcomes[i];
        const topicsStr =
          o.mccTopicsPresent.length > 5
            ? o.mccTopicsPresent.slice(0, 5).join(", ") + "..."
            : o.mccTopicsPresent.join(", ");
        return `<b>Course:</b> ${o.course}<br><b>Outcome:</b> ${o.outcomeText.substring(0, 80)}${o.outcomeText.length > 80 ? "..." : ""}<br><b>Topics:</b> ${topicsStr}`;
      }),
      hoverinfo: "text" as const,
    };
  });

  // Group outcomes by cluster for the table
  const clusterGroups = Array.from({ length: effectiveK }, (_, clusterIdx) => {
    const members = clusters
      .map((c, i) => (c === clusterIdx ? i : -1))
      .filter((i) => i !== -1)
      .map((i) => validOutcomes[i]);
    return {
      clusterIdx,
      label: CLUSTER_LABELS[clusterIdx],
      color: CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length],
      members,
    };
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <label className="flex items-center gap-3 text-sm text-western-text-body">
          <span className="whitespace-nowrap font-medium">
            Number of clusters (K):
          </span>
          <input
            type="range"
            min={2}
            max={10}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="flex-1 accent-western-purple"
          />
          <span className="w-8 text-center font-semibold text-western-purple">
            {k}
          </span>
        </label>
        <p className="text-xs text-western-silver mt-1">
          Clustering {validOutcomes.length} outcomes (
          {outcomes.length - validOutcomes.length} skipped with no MCC topics)
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <Plot
          data={traces}
          layout={
            {
              title: {
                text: "Outcome Clusters (PCA + K-Means)",
                font: { color: "#2F2E33", size: 16 },
              },
              xaxis: {
                title: { text: "Principal Component 1" },
                gridcolor: "#F4F4F6",
                zerolinecolor: "#E0E0E0",
              },
              yaxis: {
                title: { text: "Principal Component 2" },
                gridcolor: "#F4F4F6",
                zerolinecolor: "#E0E0E0",
              },
              height: 600,
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              legend: {
                orientation: "h",
                y: -0.15,
              },
              margin: { t: 60, b: 80 },
            } as Partial<Plotly.Layout>
          }
          config={{ responsive: true, displayModeBar: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Cluster membership table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-western-text-header mb-3">
          Cluster Membership
        </h3>
        <div className="space-y-2">
          {clusterGroups.map((group) => (
            <div
              key={group.clusterIdx}
              className="border border-gray-100 rounded-lg overflow-hidden"
            >
              {/* Cluster header - click to expand/collapse */}
              <button
                onClick={() =>
                  setExpandedCluster((prev) =>
                    prev === group.clusterIdx ? null : group.clusterIdx
                  )
                }
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-sm font-medium text-western-text-header">
                  {group.label}
                </span>
                <span className="text-xs text-western-silver">
                  {group.members.length} outcome
                  {group.members.length !== 1 ? "s" : ""}
                </span>
                <span className="ml-auto text-xs text-western-silver">
                  {expandedCluster === group.clusterIdx ? "▲" : "▼"}
                </span>
              </button>

              {/* Expanded table */}
              {expandedCluster === group.clusterIdx && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-western-text-body">
                        <th className="text-left px-4 py-2 font-medium w-1/5">
                          Course
                        </th>
                        <th className="text-left px-4 py-2 font-medium w-2/5">
                          Outcome
                        </th>
                        <th className="text-left px-4 py-2 font-medium w-2/5">
                          MCC Topics
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.members.map((member, idx) => (
                        <tr
                          key={idx}
                          className="border-t border-gray-50 hover:bg-gray-50"
                        >
                          <td className="px-4 py-2 text-western-purple font-medium">
                            {member.course}
                          </td>
                          <td className="px-4 py-2 text-western-text-body">
                            {member.outcomeText}
                          </td>
                          <td className="px-4 py-2 text-western-silver">
                            {member.mccTopicsPresent.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
