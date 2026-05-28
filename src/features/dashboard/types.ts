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

export interface ToolMetrics {
  name: string;
  callCount: number;
  errorCount: number;
  errorRate: number;
}

export interface CostOutlier {
  sessionId: string;
  projectName: string;
  totalCost: number;
  avgCostPerSession: number;
  totalTokens: number;
  models: string[];
  title: string | null;
}

export interface ExtendedSession {
  id: string;
  projectName: string;
  title: string | null;
  duration: number;
  totalCost: number;
  totalTokens: number;
  models: string[];
  messageCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  createdAt: number;
}

export interface ErrorTrend {
  date: string;
  totalSessions: number;
  errorSessions: number;
  errorRate: number;
}

export interface HealthMetrics {
  totalSessions: number;
  totalToolCalls: number;
  totalToolErrors: number;
  globalErrorRate: number;
  errorTrend: ErrorTrend[];
  errorRateByProject: { project: string; errorRate: number; sessionCount: number }[];
  mostFailingTools: ToolMetrics[];
  failingToolsByProject: { project: string; tools: ToolMetrics[] }[];
}

export interface PaginatedSessions {
  items: ExtendedSession[];
  nextCursor: string | null;
  totalPages: number;
  currentPage: number;
}

export interface ProjectDetail {
  project: ProjectMetrics;
  sessions: {
    id: string;
    title: string | null;
    createdAt: number;
    duration: number;
    messageCount: number;
    totalCost: number;
    totalTokens: number;
    models: string[];
    toolErrorCount: number;
  }[];
  modelUsage: ModelUsage[];
  thinkingLevels: ThinkingLevelUsage[];
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
