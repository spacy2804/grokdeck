import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { v4 as uuidv4 } from 'uuid';
import { useAgentStore } from '../stores/agentStore';
import { GrokEvent, AttachedFileRecord } from '../types/grok';

export function useAgent() {
  const store = useAgentStore();

  const startAgent = useCallback(async (opts: {
    prompt: string;
    displayText?: string;         // what to show in chat (no injected paths)
    attachedFiles?: AttachedFileRecord[];
    cwd: string;
    model?: string;
    workspaceId?: string;
    title?: string;
    _existingThreadId?: string;  // reuse an existing thread tab
  }) => {
    const threadId = opts._existingThreadId ?? uuidv4();

    if (!opts._existingThreadId) {
      // Open a new thread tab
      store.openThread({
        threadId,
        workspaceId: opts.workspaceId,
        cwd: opts.cwd,
        title: opts.title ?? (opts.displayText ?? opts.prompt).slice(0, 40),
      });
    } else {
      // Update existing thread status
      store.setThreadStatus(threadId, 'running');
    }

    store.addUserMessage(threadId, opts.displayText !== undefined ? opts.displayText : opts.prompt, opts.attachedFiles);
    store.setThreadStatus(threadId, 'running');

    // Listen for streaming events from this thread
    const unlistenEvent = await listen<GrokEvent>(`agent:event:${threadId}`, (e) => {
      handleEvent(threadId, e.payload, store);
    });

    const unlistenDone = await listen<void>(`agent:done:${threadId}`, () => {
      store.setThreadStatus(threadId, 'idle');
      unlistenEvent();
      unlistenDone();
    });

    // Spawn the agent
    try {
      await invoke('cmd_start_agent', {
        prompt: opts.prompt,
        cwd: opts.cwd,
        model: opts.model ?? null,
        threadId,
      });
    } catch (err) {
      store.setThreadStatus(threadId, 'error', String(err));
      unlistenEvent();
      unlistenDone();
    }

    return threadId;
  }, [store]);

  const resumeAgent = useCallback(async (opts: {
    sessionId: string;
    message: string;              // full prompt for grok CLI
    displayText?: string;         // what to show in chat
    attachedFiles?: AttachedFileRecord[];
    cwd: string;
    model?: string;
    threadId: string;
  }) => {
    store.addUserMessage(opts.threadId, opts.displayText !== undefined ? opts.displayText : opts.message, opts.attachedFiles);
    store.setThreadStatus(opts.threadId, 'running');

    const unlistenEvent = await listen<GrokEvent>(`agent:event:${opts.threadId}`, (e) => {
      handleEvent(opts.threadId, e.payload, store);
    });

    const unlistenDone = await listen<void>(`agent:done:${opts.threadId}`, () => {
      store.setThreadStatus(opts.threadId, 'idle');
      unlistenEvent();
      unlistenDone();
    });

    try {
      await invoke('cmd_resume_agent', {
        sessionId: opts.sessionId,
        message: opts.message,
        cwd: opts.cwd,
        model: opts.model ?? null,
        threadId: opts.threadId,
      });
    } catch (err) {
      store.setThreadStatus(opts.threadId, 'error', String(err));
      unlistenEvent();
      unlistenDone();
    }
  }, [store]);

  const stopAgent = useCallback(async (threadId: string) => {
    try {
      await invoke('cmd_stop_agent', { threadId });
    } catch (_) { /* process may have already exited */ }
    store.setThreadStatus(threadId, 'idle');
  }, [store]);

  return { startAgent, resumeAgent, stopAgent };
}

function handleEvent(threadId: string, event: GrokEvent, store: ReturnType<typeof useAgentStore.getState>) {
  switch (event.type) {
    case 'text_delta':
      store.appendAssistantDelta(threadId, event.content);
      break;

    case 'thinking':
      store.appendThinkingDelta(threadId, event.content);
      break;

    case 'tool_use':
      store.addToolCall(threadId, '', {
        id: event.id,
        name: event.name,
        input: event.input,
        status: 'pending',
      });
      break;

    case 'tool_result':
      store.updateToolResult(threadId, event.id, event.output ?? '', event.exit_code, event.is_error);
      break;

    case 'artifact_created':
      store.addArtifact(threadId, {
        name: event.name,
        path: event.path,
        size: event.size,
        mimeType: event.mime_type,
      });
      break;

    case 'turn_complete':
      if (event.session_id) {
        store.setSessionId(threadId, event.session_id);
      }
      store.finalizeAssistantMessage(threadId);
      break;

    case 'error':
      store.setThreadStatus(threadId, 'error', event.message);
      break;

    default:
      break;
  }
}
