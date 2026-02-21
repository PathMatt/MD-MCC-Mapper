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

const CLUSTER_COLORS = [
  "#4F2683",
  "#82368C",
  "#B45BC6",
  "#6A3D9A",
  "#9B59B6",
  "#7D3C98",
  "#A569BD",
  "#5B2C6F",
  "#D2B4DE",
  "#8E44AD",
];

export default function AITab({ outcomes }: AITabProps) {
  const [k, setK] = useState(5);

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

  // Build traces per cluster
  const traces = Array.from({ length: effectiveK }, (_, clusterIdx) => {
    const indices = clusters
      .map((c, i) => (c === clusterIdx ? i : -1))
      .filter((i) => i !== -1);

    return {
      x: indices.map((i) => pcaData[i][0]),
      y: indices.map((i) => pcaData[i][1]),
      mode: "markers" as const,
      type: "scatter" as const,
      name: `Cluster ${clusterIdx + 1}`,
      marker: {
        size: 8,
        color: CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length],
        opacity: 0.8,
        line: { width: 1, color: "#FFFFFF" },
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
    </div>
  );
}
