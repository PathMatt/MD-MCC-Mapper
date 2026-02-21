import Papa from "papaparse";
import * as XLSX from "xlsx";
import type {
  OutcomeRow,
  CourseAggregation,
  ParsedData,
  GraphData,
  GraphNode,
  GraphLink,
} from "@/types";

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `outcome-${idCounter}`;
}

/**
 * Parse a file (CSV or Excel) and return structured data.
 */
export function parseFile(file: File): Promise<ParsedData> {
  idCounter = 0;
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    return parseCSVFile(file);
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcelFile(file);
  } else {
    return Promise.reject(
      new Error("Unsupported file type. Please upload a .csv or .xlsx file.")
    );
  }
}

function parseCSVFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          const parsed = processRows(
            results.data as Record<string, string>[],
            results.meta.fields || []
          );
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      },
      error(err: Error) {
        reject(err);
      },
    });
  });
}

function parseExcelFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Use the first sheet by default
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to array of objects with headers
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          { defval: "" }
        );

        if (jsonData.length === 0) {
          throw new Error("The Excel file appears to be empty.");
        }

        // Get headers from the first row's keys
        const headers = Object.keys(jsonData[0]);

        // Convert all values to strings for consistency
        const stringRows: Record<string, string>[] = jsonData.map((row) => {
          const stringRow: Record<string, string> = {};
          for (const key of headers) {
            const val = row[key];
            stringRow[key] = val === null || val === undefined ? "" : String(val);
          }
          return stringRow;
        });

        const parsed = processRows(stringRows, headers);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the Excel file."));
    reader.readAsArrayBuffer(file);
  });
}

function processRows(
  rows: Record<string, string>[],
  headers: string[]
): ParsedData {
  // Find the index of the "MCCs" column
  const mccsIndex = headers.findIndex(
    (h) => h.trim().toLowerCase() === "mccs"
  );

  if (mccsIndex === -1) {
    throw new Error(
      'Could not find the "MCCs" column in your file. Please check your file format.'
    );
  }

  // Every column AFTER "MCCs" is an MCC Topic column
  const mccTopicHeaders = headers
    .slice(mccsIndex + 1)
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  // Filter rows where Course or Outcome is empty
  const validRows = rows.filter((row) => {
    const course = (row["Course"] || "").trim();
    const outcome = (row["Outcome"] || "").trim();
    return course.length > 0 && outcome.length > 0;
  });

  // Build OutcomeRow objects
  const outcomes: OutcomeRow[] = validRows.map((row) => {
    const course = (row["Course"] || "").trim();
    const outcomeText = (row["Outcome"] || "").trim();

    const mccVector: number[] = [];
    const mccTopicsPresent: string[] = [];

    for (const topic of mccTopicHeaders) {
      const rawVal = (row[topic] || "").trim().toLowerCase();
      // Check for "yes" (case-insensitive) — also catches numeric values
      // that might appear in summary rows
      const isYes = rawVal.includes("yes") ? 1 : 0;
      mccVector.push(isYes);
      if (isYes === 1) {
        mccTopicsPresent.push(topic);
      }
    }

    return {
      id: generateId(),
      course,
      outcomeText,
      mccVector,
      mccTopicsPresent,
    };
  });

  // Compute unique courses
  const coursesSet = new Set(outcomes.map((o) => o.course));
  const courses = Array.from(coursesSet).sort();

  // Build CourseAggregation
  const courseAggregations: CourseAggregation[] = courses.map((course) => {
    const courseOutcomes = outcomes.filter((o) => o.course === course);
    const topicCounts: Record<string, number> = {};

    for (const topic of mccTopicHeaders) {
      topicCounts[topic] = 0;
    }

    for (const outcome of courseOutcomes) {
      for (let i = 0; i < mccTopicHeaders.length; i++) {
        topicCounts[mccTopicHeaders[i]] += outcome.mccVector[i];
      }
    }

    return { course, topicCounts };
  });

  return {
    outcomes,
    courseAggregations,
    mccTopicHeaders,
    courses,
  };
}

export function buildGraphData(
  courseAggregations: CourseAggregation[],
  mccTopicHeaders: string[],
  visibleCourses: string[]
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const topicLinkCounts: Record<string, number> = {};

  // Only include visible courses
  const filteredAggs = courseAggregations.filter((ca) =>
    visibleCourses.includes(ca.course)
  );

  // Add course nodes
  for (const agg of filteredAggs) {
    nodes.push({
      id: `course-${agg.course}`,
      name: agg.course,
      group: 1,
      val: 12,
      color: "#4F2683",
    });

    // Build links and track topic usage
    for (const topic of mccTopicHeaders) {
      const count = agg.topicCounts[topic] || 0;
      if (count > 0) {
        topicLinkCounts[topic] = (topicLinkCounts[topic] || 0) + count;
        links.push({
          source: `course-${agg.course}`,
          target: `topic-${topic}`,
          value: count,
        });
      }
    }
  }

  // Add topic nodes only if they have at least one link
  for (const topic of mccTopicHeaders) {
    if ((topicLinkCounts[topic] || 0) > 0) {
      nodes.push({
        id: `topic-${topic}`,
        name: topic,
        group: 2,
        val: 5,
        color: "#807F83",
      });
    }
  }

  return { nodes, links };
}
