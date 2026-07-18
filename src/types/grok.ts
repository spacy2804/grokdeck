// Mirror of Rust GrokEvent enum from bridge/event_types.rs
export type GrokEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; output?: string; exit_code?: number; is_error: boolean }
  | { type: 'artifact_created'; name: string; path: string; size?: number; mime_type?: string }
  | { type: 'user_input_required'; id: string; question: string; options?: string[] }
  | { type: 'turn_complete'; session_id?: string }
  | { type: 'error'; code?: string; message: string }
  | { type: 'status'; message: string; state: 'initializing' | 'ready' | 'running' | 'stopping' | 'stopped' }
  | { type: 'unknown' };

// ─── File attachment types (mirrors openwork's ArtifactType) ───
export type FileAttachmentType = 'image' | 'text' | 'sheet' | 'document' | 'pdf' | 'unknown';

export function getFileAttachmentType(filename: string): FileAttachmentType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'tiff', 'tif'].includes(ext)) return 'image';
  if (['csv', 'tsv', 'xlsx', 'xls', 'ods'].includes(ext)) return 'sheet';
  if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)) return 'document';
  if (ext === 'pdf') return 'pdf';
  if ([
    'txt', 'md', 'markdown', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'xml',
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'scss', 'sass', 'less',
    'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'php', 'c', 'cpp', 'h', 'cs',
    'sql', 'sh', 'bash', 'zsh', 'fish', 'log', 'ini', 'env', 'conf',
  ].includes(ext)) return 'text';
  return 'unknown';
}

export interface AttachedFileRecord {
  path: string;
  name: string;
  type: FileAttachmentType;
  /** base64 data URI — populated for images via read_file_as_data_uri */
  dataUri?: string;
}

// A message in the chat thread
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  // Text content (streamed in for assistant)
  content: string;
  // Thinking/reasoning content (collapsible)
  thinking: string;
  // Tool calls embedded in this message
  toolCalls: ToolCallRecord[];
  // Artifacts created during this turn
  artifacts: ArtifactRecord[];
  // Files attached by user (only meaningful for user messages)
  attachedFiles: AttachedFileRecord[];
  createdAt: number;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  exitCode?: number;
  isError?: boolean;
  // 'pending' while running, 'done' when result received
  status: 'pending' | 'done' | 'error';
}

export interface ArtifactRecord {
  name: string;
  path: string;
  size?: number;
  mimeType?: string;
}
