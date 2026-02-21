"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Upload, BarChart3, Network, Brain, Loader2 } from "lucide-react";
import { parseFile } from "@/utils/dataParser";
import type { ParsedData } from "@/types";

// Dynamic imports to avoid SSR issues with Plotly & ForceGraph (they need `window`)
const HeatmapTab = dynamic(() => import("@/components/HeatmapTab"), {
  ssr: false,
  loading: () => <TabLoadingSpinner />,
});
const NetworkTab = dynamic(() => import("@/components/NetworkTab"), {
  ssr: false,
  loading: () => <TabLoadingSpinner />,
});
const AITab = dynamic(() => import("@/components/AITab"), {
  ssr: false,
  loading: () => <TabLoadingSpinner />,
});

function TabLoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-western-purple animate-spin" />
    </div>
  );
}

type TabId = "heatmap" | "network" | "ai";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "heatmap",
    label: "Aggregate Heatmap",
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    id: "network",
    label: "Integration Network",
    icon: <Network className="w-4 h-4" />,
  },
  {
    id: "ai",
    label: "AI Clustering",
    icon: <Brain className="w-4 h-4" />,
  },
];

export default function Home() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("heatmap");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      setError("Please upload a .csv or .xlsx file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const parsed = await parseFile(file);
      if (parsed.outcomes.length === 0) {
        setError(
          "No valid outcomes found. Make sure your file has Course and Outcome columns with data."
        );
        setIsLoading(false);
        return;
      }
      setData(parsed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse file."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleReset = useCallback(() => {
    setData(null);
    setFileName(null);
    setError(null);
    setActiveTab("heatmap");
  }, []);

  return (
    <div className="min-h-screen bg-western-bg">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-western-purple shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Curriculum Integration Dashboard
          </h1>
          {data && (
            <button
              onClick={handleReset}
              className="text-sm text-white/80 hover:text-white transition-colors border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/10"
            >
              Upload New File
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Zone */}
        {!data && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-xl">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 cursor-pointer
                  ${
                    dragActive
                      ? "border-western-purple bg-purple-50 scale-[1.02]"
                      : "border-gray-300 bg-white hover:border-western-purple hover:bg-purple-50/30"
                  }
                `}
              >
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {isLoading ? (
                  <div className="space-y-3">
                    <Loader2 className="w-12 h-12 text-western-purple animate-spin mx-auto" />
                    <p className="text-western-text-body text-sm">
                      Parsing {fileName}...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 text-western-silver mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-western-text-header">
                        Drop your CSV or Excel file here
                      </p>
                      <p className="text-sm text-western-silver mt-1">
                        or click to browse
                      </p>
                    </div>
                    <p className="text-xs text-western-silver">
                      Supports .csv and .xlsx files with Course, Outcome, MCCs,
                      and MCC Topic columns
                    </p>
                  </div>
                )}
              </div>
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dashboard */}
        {data && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wider text-western-silver font-medium">
                  Courses
                </p>
                <p className="text-2xl font-bold text-western-purple mt-1">
                  {data.courses.length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wider text-western-silver font-medium">
                  Outcomes
                </p>
                <p className="text-2xl font-bold text-western-purple mt-1">
                  {data.outcomes.length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wider text-western-silver font-medium">
                  MCC Topics
                </p>
                <p className="text-2xl font-bold text-western-purple mt-1">
                  {data.mccTopicHeaders.length}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex gap-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors
                      ${
                        activeTab === tab.id
                          ? "bg-white text-western-purple border-b-2 border-western-purple shadow-sm"
                          : "text-western-silver hover:text-western-text-body hover:bg-gray-50"
                      }
                    `}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === "heatmap" && (
                <HeatmapTab
                  courseAggregations={data.courseAggregations}
                  mccTopicHeaders={data.mccTopicHeaders}
                  courses={data.courses}
                />
              )}
              {activeTab === "network" && (
                <NetworkTab
                  courseAggregations={data.courseAggregations}
                  mccTopicHeaders={data.mccTopicHeaders}
                  courses={data.courses}
                />
              )}
              {activeTab === "ai" && <AITab outcomes={data.outcomes} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
