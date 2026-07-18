// Mirror of Rust Workspace struct from store/workspace.rs
export interface Workspace {
  id: string;
  name: string;
  color: string;       // hex color, e.g. "#ef4444"
  projectDir?: string;
  createdAt: number;
  sortOrder: number;
}

// Mirror of Rust SessionInfo
export interface SessionInfo {
  sessionId: string;
  summary: string;
  firstPrompt?: string;
  updatedAt: string;
  createdAt: string;
  cwd: string;
  numMessages: number;
  branch?: string;
  repoName?: string;
  worktreeLabel?: string;
  modelId?: string;
  // Grokdeck-assigned workspace reference
  workspaceId?: string;
}

// Mirror of Rust Settings
export interface Settings {
  grokBinaryPath?: string;
  defaultCwd?: string;
  theme: 'dark' | 'light' | 'system';
  defaultModel?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
};

// Workspace dot colors palette
export const WORKSPACE_COLORS = [
  { label: 'Red',    value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink',   value: '#ec4899' },
  { label: 'Teal',   value: '#14b8a6' },
];
