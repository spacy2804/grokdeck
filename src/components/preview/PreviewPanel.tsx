import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Code, Image as ImageIcon, Eye } from 'lucide-react';
import { usePreviewStore } from '../../stores/previewStore';
import { PreviewTab } from '../../types/preview';

// Lazy-load Monaco to avoid bloating initial bundle
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const MIN_WIDTH = 320;
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = 480;
const WIDTH_STORAGE_KEY = 'grokdeck_preview_panel_width';

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDTH;
}

function saveWidth(w: number) {
  try { localStorage.setItem(WIDTH_STORAGE_KEY, String(w)); } catch { /* ignore */ }
}

function isHtmlPath(path: string) {
  return /\.(html?|htm)$/i.test(path);
}

/** Map file extension → Monaco language id */
const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', pyi: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java', kt: 'kotlin',
  c: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  json: 'json', jsonc: 'json',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', mdx: 'markdown',
  yaml: 'yaml', yml: 'yaml',
  toml: 'toml',
  xml: 'xml', svg: 'xml',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql',
  graphql: 'graphql', gql: 'graphql',
  lua: 'lua',
  r: 'r',
  tex: 'latex',
  dockerfile: 'dockerfile',
};

function getMonacoLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const name = path.split('/').pop()?.toLowerCase() ?? '';
  if (name === 'dockerfile') return 'dockerfile';
  return EXT_TO_LANG[ext] ?? 'plaintext';
}

export default function PreviewPanel() {
  const { tabs, activeTabId, isOpen, closeTab, setActiveTab, closePanel } = usePreviewStore();

  const [panelWidth, setPanelWidth] = useState(readStoredWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');

  useEffect(() => { setViewMode('code'); }, [activeTabId]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = dragStartX.current - e.clientX;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth.current + dx));
      setPanelWidth(next);
    };
    const onUp = () => {
      setIsDragging(false);
      setPanelWidth((w) => { saveWidth(w); return w; });
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    }
  }, [isDragging]);

  const handleResizeStart = (e: React.MouseEvent) => {
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    setIsDragging(true);
    e.preventDefault();
  };

  if (!isOpen || tabs.length === 0) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const showToggle = activeTab ? isHtmlPath(activeTab.path) : false;

  // iframe + monaco don't want outer padding — only csv/image do
  const isPaddedView = activeTab
    ? (activeTab.tabType === 'csv' || activeTab.tabType === 'image')
    : false;
  const isIframe = showToggle && viewMode === 'preview';

  return (
    <motion.div
      className="preview-panel"
      style={{ width: panelWidth, userSelect: isDragging ? 'none' : undefined }}
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: panelWidth, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={isDragging ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 300 }}
    >
      {/* Resize handle */}
      <div
        className={`preview-resize-handle ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      />

      {/* Tab bar */}
      <div className="preview-tabs">
        <div className="preview-tabs-scroll">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`preview-tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon type={tab.tabType} isHtml={isHtmlPath(tab.path)} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
              <span
                className="preview-tab-close"
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              >
                <X size={11} />
              </span>
            </div>
          ))}
        </div>

        {showToggle && (
          <div className="preview-view-toggle">
            <button
              className={`preview-view-btn ${viewMode === 'code' ? 'active' : ''}`}
              onClick={() => setViewMode('code')}
              title="View source code"
            >
              <Code size={11} />
              Code
            </button>
            <button
              className={`preview-view-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
              title="Preview in browser"
            >
              <Eye size={11} />
              Preview
            </button>
          </div>
        )}

        <button className="preview-panel-close" onClick={closePanel} title="Close preview">
          <X size={14} />
        </button>
      </div>

      {/* Content — no padding for editor/iframe, padding for csv/image */}
      <div className={`preview-content ${isPaddedView ? 'padded' : ''} ${isIframe ? 'iframe-view' : ''}`}>
        {activeTab && <PreviewContent tab={activeTab} viewMode={viewMode} />}
      </div>
    </motion.div>
  );
}

/* ─── Tab icon ───────────────────────────────────────────────── */
function TabIcon({ type, isHtml }: { type: PreviewTab['tabType']; isHtml?: boolean }) {
  if (isHtml) return <Code size={12} style={{ color: 'var(--orange, #f97316)', flexShrink: 0 }} />;
  switch (type) {
    case 'csv':    return <FileText size={12} style={{ color: 'var(--green)', flexShrink: 0 }} />;
    case 'image':  return <ImageIcon size={12} style={{ color: 'var(--blue)', flexShrink: 0 }} />;
    default:       return <Code size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
  }
}

/* ─── Content router ─────────────────────────────────────────── */
function PreviewContent({ tab, viewMode }: { tab: PreviewTab; viewMode: 'code' | 'preview' }) {
  if (isHtmlPath(tab.path) && viewMode === 'preview') {
    return <HtmlPreview path={tab.path} content={tab.content} />;
  }
  switch (tab.tabType) {
    case 'csv':    return <CsvViewer path={tab.path} content={tab.content} />;
    case 'image':  return <ImageViewer path={tab.path} />;
    default:       return <MonacoCodeViewer path={tab.path} content={tab.content} />;
  }
}

/* ─── Monaco Code Viewer ─────────────────────────────────────── */
function MonacoCodeViewer({ path, content }: { path: string; content?: string }) {
  const [text, setText] = React.useState(content ?? '');
  const [loading, setLoading] = React.useState(!content);
  const language = getMonacoLanguage(path);

  React.useEffect(() => {
    if (content) { setText(content); return; }
    setLoading(true);
    import('@tauri-apps/plugin-fs').then(({ readTextFile }) =>
      readTextFile(path)
        .then(setText)
        .catch((e) => setText(`// Error loading file: ${e}`))
        .finally(() => setLoading(false)),
    );
  }, [path, content]);

  if (loading) return <div className="preview-loading">Loading…</div>;

  return (
    <Suspense fallback={<div className="preview-loading">Loading editor…</div>}>
      <MonacoEditor
        height="100%"
        language={language}
        value={text}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
          padding: { top: 12, bottom: 12 },
          tabSize: 2,
          wordWrap: 'on',
          automaticLayout: true, // re-layout on panel resize
        }}
      />
    </Suspense>
  );
}

/* ─── HTML Preview (sandboxed iframe) ───────────────────────── */
function HtmlPreview({ path, content }: { path: string; content?: string }) {
  const [html, setHtml] = React.useState(content ?? '');
  const [loading, setLoading] = React.useState(!content);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (content) { setHtml(content); return; }
    setLoading(true);
    import('@tauri-apps/plugin-fs').then(({ readTextFile }) =>
      readTextFile(path)
        .then((text) => { setHtml(text); })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false)),
    );
  }, [path, content]);

  if (loading) return <div className="preview-loading">Loading…</div>;
  if (error) return <div className="preview-error">{error}</div>;

  return (
    <iframe
      key={path}
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin allow-forms"
      className="preview-iframe"
      title={path}
    />
  );
}

/* ─── Image Viewer ───────────────────────────────────────────── */
function ImageViewer({ path }: { path: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
      <img
        src={`file://${path}`}
        alt={path}
        style={{ maxWidth: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
      />
    </div>
  );
}

/* ─── CSV Table Viewer ───────────────────────────────────────── */
function CsvViewer({ path, content }: { path: string; content?: string }) {
  const [data, setData] = React.useState<string[][]>([]);
  const [loading, setLoading] = React.useState(!content);

  React.useEffect(() => {
    if (content) { setData(parseCsv(content)); return; }
    import('@tauri-apps/plugin-fs').then(({ readTextFile }) =>
      readTextFile(path)
        .then((text) => setData(parseCsv(text)))
        .catch(() => setData([['Error loading file']]))
        .finally(() => setLoading(false)),
    );
  }, [path, content]);

  if (loading) return <div className="preview-loading">Loading…</div>;
  if (data.length === 0) return <div className="preview-loading">Empty file</div>;

  const headers = data[0];
  const rows = data.slice(1);

  return (
    <div style={{ overflowX: 'auto', padding: '14px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '8px 12px', textAlign: 'left',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '7px 12px', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', maxWidth: 200,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ paddingTop: '8px', fontSize: 12, color: 'var(--text-muted)' }}>
        {rows.length} rows × {headers.length} columns
      </div>
    </div>
  );
}

function parseCsv(text: string): string[][] {
  return text.split('\n').filter((l) => l.trim()).map((line) => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur);
    return result;
  });
}
