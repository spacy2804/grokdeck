# Grokdeck

> A native desktop GUI for [Grok CLI](https://github.com/xai-org/grok-cli) — built with Tauri, React, and Rust.

Grokdeck wraps the `grok` command-line tool in a polished, multi-tab desktop interface. It streams AI responses in real time, visualizes tool calls, auto-detects created files, and lets you preview them instantly — all without leaving the app.

---

## Features

### Chat
- **Multi-tab conversations** — open multiple threads side-by-side, switch between them freely
- **Real-time streaming** — token-by-token text with live tool-call progress indicators
- **Thinking blocks** — collapsible reasoning steps (`<thinking>` output)
- **Tool call cards** — `str_replace_editor`, bash, and other tools shown with inputs/outputs
- **File attachments** — attach any file to a message; paths are injected into the CLI prompt
- **Session history** — past grok sessions appear in the sidebar and can be reopened

### Artifact Detection
When grok creates or edits files, Grokdeck automatically detects them and shows a clickable pill:
- Scans `str_replace_editor` / `write_file` tool inputs (confidence 95 — most reliable)
- Scans tool output text for file paths (confidence 85)
- Scans assistant message text for file mentions (confidence 65, requires keyword heuristic)
- Async existence verification for lower-confidence detections
- Click any pill to open the file instantly in the Preview Panel

### Preview Panel
A resizable side panel (320–1200 px, width persists across sessions) for reviewing files:

| File type | Viewer |
|---|---|
| Code (`.ts`, `.rs`, `.py`, `.go`, 30+ langs) | Monaco Editor — dark theme, syntax highlighting, word wrap |
| HTML (`.html`, `.htm`) | **Code** tab (Monaco) + **Preview** tab (sandboxed iframe) |
| CSV / TSV | Sortable table view |
| Images (`.png`, `.jpg`, `.svg`, …) | Inline image viewer |

The **Code ↔ Preview toggle** for HTML lets you switch between viewing source and a live rendered preview in a sandboxed iframe.

---

## Tech Stack

### Frontend
| Package | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript 5.8 | Type safety |
| Vite 7 | Build tool / dev server |
| Zustand 5 | State management (agent, preview, workspace stores) |
| Framer Motion | Animations (panel open/close, message transitions) |
| Monaco Editor | Code viewer in Preview Panel |
| Marked + DOMPurify | Markdown rendering with XSS sanitization |
| Lucide React | Icons |
| React Router 7 | Page routing (onboarding → main → settings) |

### Backend (Rust / Tauri 2)
| Module | Responsibility |
|---|---|
| `commands/agent.rs` | Spawns `grok` CLI subprocess, emits streaming events |
| `commands/session.rs` | Lists, loads, and restores past grok sessions |
| `commands/auth.rs` | API key management |
| `commands/install.rs` | Checks for / installs grok CLI |
| `commands/workspace.rs` | Workspace CRUD (maps to grok workspaces) |
| `bridge/event_types.rs` | Typed deserialization of grok CLI SSE events |
| `store/` | Persistent app state (settings, workspaces) |

### Event pipeline
```
grok CLI (stdout) → Tauri bridge → tauri::emit() → React useAgent hook → Zustand store → UI
```

Event types: `text` · `thought` · `tool_use` · `tool_result` · `status` · `end` · `error`

---

## Prerequisites

- **Rust** (stable) — [rustup.rs](https://rustup.rs)
- **Node.js** ≥ 18
- **Grok CLI** — must be installed and authenticated (`grok auth login`)
- **Tauri CLI v2** — installed automatically via `npm run tauri`

---

## Getting Started

```bash
# 1. Clone the repo
git clone <repo-url>
cd grokdeck

# 2. Install JS dependencies
npm install

# 3. Start the app in development mode
npm run tauri dev
```

The app will launch with a Vite hot-reload frontend and a live Tauri backend. Changes to `.tsx`/`.ts` files hot-reload instantly; changes to Rust files require a recompile (happens automatically).

### Production build

```bash
npm run tauri build
```

Output binary is placed in `src-tauri/target/release/`.

---

## Project Structure

```
grokdeck/
├── src/                        # React frontend
│   ├── components/
│   │   ├── chat/               # ChatArea, MessageBubble, ToolCallCard, StreamingIndicator…
│   │   ├── preview/            # PreviewPanel (Monaco, iframe, CSV, image)
│   │   ├── sidebar/            # Session list, workspace picker
│   │   ├── settings/           # Settings page
│   │   ├── onboarding/         # First-run setup flow
│   │   └── shared/             # Markdown renderer, ProtectedRoute…
│   ├── hooks/
│   │   ├── useAgent.ts         # startAgent / resumeAgent — Tauri IPC + event streaming
│   │   ├── useHandleSend.ts    # Input submit logic (prompt building, file injection)
│   │   ├── useDerivedArtifacts.ts  # Artifact detection hook
│   │   ├── useFileAttachment.ts    # File picker + dataUri for images
│   │   ├── useAuth.tsx         # Auth state
│   │   └── useWorkspaces.ts    # Workspace management
│   ├── stores/
│   │   ├── agentStore.ts       # Thread & message state (Zustand)
│   │   ├── previewStore.ts     # Open tabs in Preview Panel
│   │   └── workspaceStore.ts   # Active workspace
│   ├── utils/
│   │   ├── artifactDetection.ts   # deriveMessageArtifacts — multi-source, confidence-scored
│   │   └── chatUtils.ts           # Shared helpers (formatSize, getTypeBadge…)
│   └── types/
│       ├── grok.ts             # ChatMessage, ToolCallRecord, AttachedFileRecord…
│       └── preview.ts          # PreviewTab, PreviewTabType
│
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── bridge/             # Event type definitions and grok CLI output parsing
│   │   ├── commands/           # Tauri command handlers
│   │   └── store/              # Persistent settings / workspace data
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## How Artifact Detection Works

Grokdeck infers created files by scanning each assistant message through multiple sources, each with a confidence score:

| Source | Confidence | Example |
|---|---|---|
| `message.artifacts` (explicit events) | 100 | Future: dedicated artifact events |
| Write tool input (`path` / `file` key) | 95 | `str_replace_editor` → `input.path` |
| Write tool output text | 85 | Scan `tool_result.output` |
| Message content (with keyword gate) | 65 | "file `index.html`" |

- **High confidence (≥ 85)**: shown immediately — no existence check needed
- **Low confidence (< 85)**: verified with `fs.exists()` before displaying

Detected artifacts appear as clickable pills below the assistant message. Clicking opens the file in the Preview Panel.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | New line in input |

---

## IDE Setup

- **VS Code** + [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## License

[MIT](./LICENSE) © 2026 spacy2804
