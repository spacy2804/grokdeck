import { FileAttachmentType, getFileAttachmentType, ChatMessage } from '../types/grok';
import { PreviewTabType } from '../types/preview';

// ─── File preview helpers ──────────────────────────────────────────

/** Map file attachment type to PreviewPanel tabType */
export function toPreviewTabType(name: string, type: FileAttachmentType): PreviewTabType {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (type === 'image') return 'image';
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'json' || ext === 'jsonc') return 'json';
  return 'code';
}

/** Return uppercase extension badge label, or null */
export function getTypeBadge(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext || ext.length > 5) return null;
  return ext.toUpperCase();
}

// ─── Artifact path detection in assistant text ─────────────────────

const FILE_PATH_RE =
  /(?:^|[\s"'`([{])(\/?(?:[\w.\-]+\/)+[\w.\-]+\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|json|yaml|yml|toml|md|csv|txt|html|css|scss|sh|sql|xml|log|env|png|jpg|jpeg|gif|webp|svg|pdf|docx|xlsx))\b/gi;
const ARTIFACT_MENTION_RE =
  /\b(?:created?|wrote|written|saved?|generated?|output|artifact|exported?|updated?|file)\b/i;

export function extractArtifactPaths(
  text: string,
): { path: string; name: string; type: FileAttachmentType }[] {
  if (!ARTIFACT_MENTION_RE.test(text)) return [];
  FILE_PATH_RE.lastIndex = 0;
  const seen = new Set<string>();
  const results: { path: string; name: string; type: FileAttachmentType }[] = [];
  for (const match of text.matchAll(FILE_PATH_RE)) {
    const path = match[1];
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const name = path.split('/').pop() ?? path;
    results.push({ path, name, type: getFileAttachmentType(name) });
  }
  return results;
}

// ─── Tool label map ────────────────────────────────────────────────

export const TOOL_LABELS: Record<string, string> = {
  bash:                        'Running bash…',
  shell:                       'Running shell…',
  view:                        'Viewing file…',
  read_file:                   'Reading file…',
  str_replace_editor:          'Editing file…',
  str_replace_based_edit_tool: 'Editing file…',
  create_file:                 'Creating file…',
  write_file:                  'Writing file…',
  grep:                        'Searching…',
  grep_search:                 'Searching…',
  find_files:                  'Searching files…',
  glob:                        'Listing files…',
  web_search:                  'Searching the web…',
  browser_action:              'Browsing the web…',
  computer_use:                'Using computer…',
};

/** Scan messages for the last pending tool call → human-readable label */
export function getActiveToolLabel(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    const pending = msg.toolCalls.find((tc) => tc.status === 'pending');
    if (pending) {
      return TOOL_LABELS[pending.name] ?? `Using ${pending.name}…`;
    }
  }
  return 'Thinking…';
}

// ─── Misc ──────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
