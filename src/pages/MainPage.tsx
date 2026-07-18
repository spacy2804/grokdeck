import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import Sidebar from '../components/sidebar/Sidebar';
import ChatArea from '../components/chat/ChatArea';
import PreviewPanel from '../components/preview/PreviewPanel';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { SessionInfo } from '../types/workspace';
import { useAgentStore } from '../stores/agentStore';
import { usePreviewStore } from '../stores/previewStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useNavigate } from 'react-router-dom';

export default function MainPage() {
  const { loadWorkspaces, loadSessions, loadSettings } = useWorkspaces();
  const openThread = useAgentStore((s) => s.openThread);
  const isPreviewOpen = usePreviewStore((s) => s.isOpen);
  const navigate = useNavigate();

  // Apply theme
  const currentTheme = useWorkspaceStore((s) => s.settings.theme);
  useEffect(() => {
    const effective = currentTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : currentTheme;
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${effective}`);
    document.documentElement.setAttribute('data-theme', effective);
  }, [currentTheme]);

  // Load initial data
  useEffect(() => {
    invoke('ensure_default_workspace').catch(() => {});
    loadSettings();
    loadWorkspaces();
    loadSessions();
  }, []);

  // Auto-reload sidebar when a new session is created (session_id assigned after first turn)
  useEffect(() => {
    const knownSessionIds = new Set<string>();
    // Initialize with current sessions
    const threads = useAgentStore.getState().threads;
    threads.forEach((t) => { if (t.sessionId) knownSessionIds.add(t.sessionId); });

    const unsub = useAgentStore.subscribe((state) => {
      for (const thread of state.threads) {
        if (thread.sessionId && !knownSessionIds.has(thread.sessionId)) {
          knownSessionIds.add(thread.sessionId);
          // A new session was created — refresh sidebar
          loadSessions();
          break;
        }
      }
    });
    return unsub;
  }, [loadSessions]);

  const handleNewSession = async (workspaceId: string, cwd: string) => {
    const { v4: uuidv4 } = await import('uuid');
    const threadId = uuidv4();
    openThread({
      threadId,
      workspaceId,
      cwd,
      title: 'New session',
    });
  };

  const handleSessionClick = async (session: SessionInfo) => {
    const threads = useAgentStore.getState().threads;
    const existing = threads.find((t) => t.sessionId === session.sessionId);
    if (existing) {
      useAgentStore.getState().setActiveThread(existing.threadId);
      return;
    }
    const { v4: uuidv4 } = await import('uuid');
    const threadId = uuidv4();
    const title = session.summary || session.firstPrompt?.slice(0, 40) || session.sessionId.slice(0, 12);
    openThread({
      threadId,
      sessionId: session.sessionId,
      workspaceId: session.workspaceId,
      cwd: session.cwd || '/',
      title,
    });

    // Load chat history for this session
    try {
      const history = await invoke<Array<{ role: string; content: string; toolName?: string; toolId?: string }>>('cmd_load_chat_history', {
        sessionId: session.sessionId,
      });
      const store = useAgentStore.getState();
      for (const msg of history) {
        if (msg.role === 'user') {
          store.addUserMessage(threadId, msg.content);
        } else if (msg.role === 'thinking') {
          store.appendThinkingDelta(threadId, msg.content);
        } else if (msg.role === 'tool_use') {
          store.addToolCall(threadId, '', {
            id: msg.toolId || `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: msg.toolName || 'tool',
            input: { query: msg.content },
            status: 'done',
          });
        } else if (msg.role === 'tool_result') {
          // Tool results are attached to the last tool call
          const threads = store.threads;
          const thread = threads.find(t => t.threadId === threadId);
          const lastMsg = thread?.messages[thread.messages.length - 1];
          const lastTool = lastMsg?.toolCalls[lastMsg.toolCalls.length - 1];
          if (lastTool) {
            store.updateToolResult(threadId, lastTool.id, msg.content);
          }
        } else if (msg.role === 'assistant') {
          store.appendAssistantDelta(threadId, msg.content);
          store.finalizeAssistantMessage(threadId);
        }
      }
    } catch {
      // Chat history load failed — thread still works for new messages
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        onSessionClick={handleSessionClick}
        onOpenSettings={() => navigate('/settings')}
        onNewSession={handleNewSession}
      />

      <div className="main-content">
        <ChatArea onOpenSettings={() => navigate('/settings')} />
        <AnimatePresence>
          {isPreviewOpen && <PreviewPanel key="preview" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
