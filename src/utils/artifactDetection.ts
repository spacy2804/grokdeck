import { ChatMessage } from '../types/grok';
import { PreviewTabType } from '../types/preview';

export interface DerivedArtifact {
  /** Dedup key, e.g. "file:/abs/path/file.html" */
  id: string;
  /** Resolved absolute path */
  path: string;
  /** Basename */
  name: string;
  /** 40–100 — higher = more reliable source */
  confidence: number;
  /** For PreviewPanel */
  previewType: PreviewTabType;
}

// ── Write tool names that grok CLI uses ───────────────────────────

const WRITE_TOOL_NAMES = new Set([
  'str_replace_editor',
  'str_replace_based_edit_tool',
  'create_file',
  'write_file',
  'write',
  'edit',
  'edit_file',
  'apply_patch',
]);

/**
 * "view" commands on str_replace_editor — should NOT produce artifacts
 * since no file is being written.
 */
const VIEW_COMMANDS = new Set(['view', 'read', 'cat']);

/** JSON keys checked in tool input/output for file paths */
const FILE_METADATA_KEYS = ['path', 'file', 'filePath', 'filepath', 'file_path', 'filename'];

// ── Patterns ─────────────────────────────────────────────────────

/**
 * Matches both paths-with-slashes AND bare filenames.
 * Adapted from openwork's FILE_PATTERN.
 */
const FILE_PATTERN =
  /(?:^|[\s"'`([{])((?:\.{1,2}\/|~\/|\/)?[\w.\-]+(?:\/[\w.\-]+)+\.[a-z][a-z0-9]{0,9}|[\w.\-]+\.[a-z][a-z0-9]{0,9})/gi;

/**
 * Keywords that suggest the assistant is mentioning a file it produced.
 * Includes Vietnamese keywords for grok's Vietnamese responses.
 */
const MENTION_PATTERN =
  /\b(?:created?|wrote|written|saved?|generated?|output|artifact|exported?|updated?|file|tại file|đã tạo|tệp tin|tệp)\b/i;

// ── Extension → preview type ──────────────────────────────────────

const EXT_TO_PREVIEW: Record<string, PreviewTabType> = {
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  csv: 'csv', tsv: 'csv',
  json: 'json', jsonc: 'json',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
};

function getPreviewType(name: string): PreviewTabType {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_PREVIEW[ext] ?? 'code';
}

// ── Path helpers ──────────────────────────────────────────────────

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p;
}

function resolvePath(raw: string, cwd: string): string {
  const clean = raw.replace(/\\/g, '/').trim().replace(/[.,;:'"]+$/, '');
  if (!clean) return '';
  if (clean.startsWith('/')) return clean;
  if (clean.startsWith('./')) return `${cwd}/${clean.slice(2)}`;
  if (clean.startsWith('~/')) {
    // ~ expansion — best effort in frontend context
    return clean;
  }
  return `${cwd}/${clean}`;
}

// ── Artifact construction ─────────────────────────────────────────

function makeArtifact(rawPath: string, cwd: string, confidence: number): DerivedArtifact | null {
  const clean = rawPath.trim().replace(/[.,;:'"]+$/, '');
  if (!clean || clean.length > 300) return null;
  if (!clean.includes('.')) return null;         // no extension → skip
  if (/^https?:\/\//i.test(clean)) return null; // not a local file

  const path = resolvePath(clean, cwd);
  if (!path) return null;

  const name = basename(path);
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (!ext || ext.length > 10) return null;

  return {
    id: `file:${path.toLowerCase()}`,
    path,
    name,
    confidence,
    previewType: getPreviewType(name),
  };
}

function addArtifact(map: Map<string, DerivedArtifact>, artifact: DerivedArtifact | null) {
  if (!artifact) return;
  const existing = map.get(artifact.id);
  if (!existing || artifact.confidence > existing.confidence) {
    map.set(artifact.id, artifact);
  }
}

// ── Tool input extraction ─────────────────────────────────────────

function extractFilePathsFromObject(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const obj = value as Record<string, unknown>;
  const results: string[] = [];
  for (const key of FILE_METADATA_KEYS) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) results.push(v.trim());
  }
  // Support: { files: ["a.py", "b.py"] }
  const files = obj['files'];
  if (Array.isArray(files)) {
    for (const f of files) {
      if (typeof f === 'string' && f.trim()) results.push(f.trim());
    }
  }
  return results;
}

function scanText(
  map: Map<string, DerivedArtifact>,
  text: string,
  cwd: string,
  confidence: number,
) {
  if (!text) return;
  FILE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(FILE_PATTERN)) {
    if (match[1]) addArtifact(map, makeArtifact(match[1], cwd, confidence));
  }
}

// ── Main export ───────────────────────────────────────────────────

/**
 * Derive all artifact candidates from a single assistant message.
 *
 * Sources and their confidence scores (higher = more reliable):
 * - `message.artifacts`           → 100 (explicit store events — future use)
 * - Write tool input `path`/`file` → 95  (most reliable — direct tool arg)
 * - Write tool output text scan    → 85  (reliable — tool just ran)
 * - Message content text scan      → 65  (requires keyword heuristic)
 *
 * Results are deduplicated by path and sorted by confidence descending.
 */
export function deriveMessageArtifacts(
  message: ChatMessage,
  cwd: string,
): DerivedArtifact[] {
  if (message.role !== 'assistant') return [];

  const map = new Map<string, DerivedArtifact>();

  // ── Explicit artifacts from store (artifact_created events) ──
  for (const a of message.artifacts) {
    addArtifact(map, makeArtifact(a.path, cwd, 100));
  }

  // ── Scan tool calls ──────────────────────────────────────────
  for (const tool of message.toolCalls) {
    const isWrite = WRITE_TOOL_NAMES.has(tool.name);
    if (!isWrite) continue;

    // Skip "view" commands on str_replace_editor
    const cmd =
      tool.input && typeof tool.input === 'object'
        ? String((tool.input as Record<string, unknown>)['command'] ?? '')
        : '';
    if (VIEW_COMMANDS.has(cmd.toLowerCase())) continue;

    // Extract paths from tool input (highest confidence)
    for (const rawPath of extractFilePathsFromObject(tool.input)) {
      addArtifact(map, makeArtifact(rawPath, cwd, 95));
    }

    // Scan tool output text (slightly lower)
    if (tool.output) {
      scanText(map, tool.output, cwd, 85);
    }
  }

  // ── Scan message content text (with keyword gate) ───────────
  if (message.content && MENTION_PATTERN.test(message.content)) {
    scanText(map, message.content, cwd, 65);
  }

  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}
