export interface OutcomeRow {
  id: string;
  course: string;
  outcomeText: string;
  mccVector: number[];
  mccTopicsPresent: string[];
}

export interface CourseAggregation {
  course: string;
  topicCounts: Record<string, number>;
}

export interface ParsedData {
  outcomes: OutcomeRow[];
  courseAggregations: CourseAggregation[];
  mccTopicHeaders: string[];
  courses: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  group: number;
  val: number;
  color: string;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
