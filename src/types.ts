export interface GitCommit {
  id: string;
  hash: string;
  message: string;
  author: string;
  date: string;
  color: string;
  branch?: string;
  active?: boolean;
  remote?: boolean;
  type?: "info" | "commit";
}

export interface LLMModel {
  id: string;
  name: string;
  provider: "Anthropic" | "OpenAI" | "Google" | "Meta";
  tag?: string;
  description: string;
  contextSize: string;
  speed: string;
  costMultiplier: string;
  isNew?: boolean;
  discount?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface FileNode {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileNode[];
}

export interface AgentAction {
  id: string;
  type: "read_file" | "write_file" | "create_file" | "run_command" | "list_files" | "think" | "query_database" | "list_tables" | "insert_code" | "analyze_code" | "review_pr" | "search_code";
  description: string;
  path?: string;
  content?: string;
  command?: string;
  reasoning?: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
}

export interface AgentTask {
  id: string;
  instruction: string;
  status: "pending" | "running" | "completed" | "failed";
  steps: AgentAction[];
  createdAt: Date;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  task?: AgentTask;
  actions?: AgentAction[];
}

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: "file_change" | "command" | "ai_action" | "session_start";
  description: string;
  metadata: {
    path?: string;
    content?: string;
    command?: string;
    result?: string;
    message?: string;
    actionType?: string;
  };
}

export type ViewType = "files" | "search" | "chat" | "mcp" | "agents" | "collaboration" | "knowledge" | "timeline" | "palace" | "settings" | "git" | "extensions" | "setup";

export interface Extension {
  id: string;
  name: string;
  publisher: string;
  displayName: string;
  description: string;
  version: string;
  icon?: string;
  installed: boolean;
  enabled: boolean;
  category: "Language" | "Theme" | "Linter" | "Snippet" | "Other";
  downloads?: number;
  rating?: number;
}

export interface CollaborationSession {
  id: string;
  host: string;
  activeUsers: { name: string; color: string; status: "online" | "away" }[];
  isRecording: boolean;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  type: "pdf" | "md" | "txt";
  size: string;
  uploadedAt: string;
}

export interface RefactoringProposal {
  id: string;
  title: string;
  description: string;
  impact: "low" | "medium" | "high";
  filePath: string;
  diff: string;
  status: "pending" | "applied" | "rejected";
}

export interface DBConnection {
  id: string;
  name: string;
  type: "postgresql" | "mysql";
  status: "connected" | "disconnected";
}

export type PanelTab = "terminal" | "debug" | "output" | "sessions" | "plsql_docs" | "review_results" | "test_gen" | "profiler";

export interface SessionMeta {
  sessionId: string;
  command: string;
  startTime: number;
  tabId: string;
  tabTitle: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  output: string[];
  history: string[];
  cwd: string;
  /** Session ID of the currently running process in this tab, if any. */
  runningSessionId?: string;
}

export interface TriggerConfig {
  table: string;
  timing: "BEFORE" | "AFTER" | "INSTEAD OF";
  event: "INSERT" | "UPDATE" | "DELETE";
  action: string;
}
