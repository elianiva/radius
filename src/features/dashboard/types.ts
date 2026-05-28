export interface ProjectMetrics {
  id: string;
  name: string;
  sessionCount: number;
  totalCost: number;
  avgMessagesPerSession: number;
  avgDuration: number;
  errorRate: number;
  mostUsedModel: string;
}

export interface CostOverTime {
  date: string;
  cost: number;
  sessions: number;
}

export interface ModelUsage {
  model: string;
  count: number;
  cost: number;
}

export interface ThinkingLevelUsage {
  level: string;
  count: number;
}

export interface StopReason {
  reason: string;
  count: number;
}

export interface MostUsedModel {
  name: string;
  count: number;
}

export interface DashboardMetrics {
  totalSessions: number;
  totalCost: number;
  avgCostPerSession: number;
  totalTokens: number;
  errorRate: number;
  mostUsedModel: MostUsedModel;
  costOverTime: CostOverTime[];
  modelUsage: ModelUsage[];
  thinkingLevels: ThinkingLevelUsage[];
  stopReasons: StopReason[];
  projects: ProjectMetrics[];
  topProjects: readonly { name: string; sessionCount: number; cost: number }[];
}
