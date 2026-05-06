import { DBConnection, GitCommit, LLMModel, TerminalTab } from "./types";

// ─── App-wide configuration ──────────────────────────────────────────────────
export const APP_TITLE = "Nexus AI Editor";
export const APP_SUBTITLE = "Editing evolved";
export const DEFAULT_MODEL_ID = "Claude-Sonnet-4.6";
export const GIT_STATUS_POLL_MS = 10_000;
export const AUTOCOMPLETE_DEBOUNCE_MS = 150;
export const AUTOCOMPLETE_THROTTLE_MS = 100;
export const AUTOCOMPLETE_PREFIX_LINES = 50;
export const AUTOCOMPLETE_SUFFIX_LINES = 20;
export const TERMINAL_HISTORY_LIMIT = 50;

// ─── Initial UI state ─────────────────────────────────────────────────────────
export const INITIAL_TERMINAL_TABS: TerminalTab[] = [
  {
    id: "term-1",
    title: "zsh",
    output: [`Welcome to ${APP_TITLE} Terminal.`, "Ready..."],
    history: [],
    cwd: "",
  },
];

export const INITIAL_CHANGED_FILES: { path: string; status: string }[] = [
  { path: "src/App.tsx", status: "M" },
  { path: "src/services/gitService.ts", status: "M" },
  { path: "package.json", status: "M" },
  { path: "public/index.html", status: "U" },
];

export const INITIAL_DB_CONNECTIONS: DBConnection[] = [
  { id: "1", name: "Internal PG", type: "postgresql", status: "connected" },
];

export const MODELS: LLMModel[] = [
  { 
    id: "Claude-Opus-3.5", 
    name: "Claude Opus 3.5", 
    provider: "Anthropic", 
    tag: "High", 
    description: "Most powerful model for complex creative and technical tasks.", 
    contextSize: "200K", 
    speed: "Medium", 
    costMultiplier: "3x" 
  },
  { 
    id: "Claude-Sonnet-3.5", 
    name: "Claude Sonnet 3.5", 
    provider: "Anthropic", 
    tag: "High", 
    description: "Ideal balance between intelligence and speed.", 
    contextSize: "200K", 
    speed: "Fast", 
    costMultiplier: "1x",
    isNew: true
  },
  { 
    id: "Claude-Sonnet-4.6", 
    name: "Claude Sonnet 4.6", 
    provider: "Anthropic", 
    tag: "High", 
    description: "Next-gen balanced model with enhanced reasoning.", 
    contextSize: "200K", 
    speed: "Fast", 
    costMultiplier: "1x",
    isNew: true,
    discount: "10% discount"
  },
  { 
    id: "GPT-4o", 
    name: "GPT-4o", 
    provider: "OpenAI", 
    description: "Optimized GPT-4 model with faster responses and multimodal capabilities.", 
    contextSize: "128K", 
    speed: "Instant", 
    costMultiplier: "0.5x" 
  },
  { 
    id: "GPT-4.1", 
    name: "GPT-4.1", 
    provider: "OpenAI", 
    description: "Rock-solid reliability for code generation and logic.", 
    contextSize: "128K", 
    speed: "Fast", 
    costMultiplier: "1x" 
  },
  { 
    id: "GPT-5.4", 
    name: "GPT-5.4", 
    provider: "OpenAI", 
    tag: "Medium", 
    description: "Experimental high-reasoning model for extreme logic tasks.", 
    contextSize: "512K", 
    speed: "Medium", 
    costMultiplier: "2x",
    isNew: true
  },
  { 
    id: "gemini-2.0-flash", 
    name: "Gemini 2.0 Flash", 
    provider: "Google", 
    description: "Latest stable Gemini model — fast, supports code, SQL and large context.", 
    contextSize: "1M", 
    speed: "Fast", 
    costMultiplier: "1x",
    isNew: true
  }
];

export const MOCK_GIT_COMMITS: GitCommit[] = [
  { id: '1', hash: 'a1b2c3d', message: 'TMO.DEV.BILLABLE ORDER UPDATE 2026...', author: 'Haley Vesey', date: '2 hours ago', branch: 'origin/develop', color: '#a855f7', remote: true },
  { id: '2', hash: 'e4f5g6h', message: "Update to remove '_PROD'", author: 'Haley Vesey', date: '5 hours ago', color: '#a855f7' },
  { id: '3', hash: 'i7j8k9l', message: 'Incoming Changes', author: 'origin/develop', date: '6 hours ago', type: 'info', color: '#a855f7' },
  { id: '4', hash: 'm1n2o3p', message: 'Add Network Full id to NETWORK_MATER...', author: 'Maneesh', date: '1 day ago', branch: 'develop', active: true, color: '#3b82f6' },
  { id: '5', hash: 'q4r5s6t', message: "Merge branch 'develop' into add-network-full", author: 'Courtney D...', date: '2 days ago', color: '#ec4899' },
  { id: '6', hash: 'u7v8w9x', message: 'daa/Add Unknown to the dimension tables (#5932)', author: 'Maneesh', date: '2 days ago', color: '#3b82f6' },
  { id: '7', hash: 'y1z2a3b', message: "Merge branch 'develop' into daa/unkown_dim_tables...", author: 'Maneesh', date: '3 days ago', color: '#06b6d4' },
  { id: '8', hash: 'c4d5e6f', message: 'parmo/stratification_legacy_changes (#5917)', author: 'Maneesh', date: '3 days ago', color: '#3b82f6' },
  { id: '9', hash: 'g7h8i9j', message: "Merge branch 'develop' into parmo/stratification_leg...", author: 'Maneesh', date: '4 days ago', color: '#eab308' },
  { id: '10', hash: 'k1l2m3n', message: 'parmo/ China data in OTIF (#5977)', author: 'Maneesh Chandra...', date: '1 week ago', color: '#eab308' },
];
