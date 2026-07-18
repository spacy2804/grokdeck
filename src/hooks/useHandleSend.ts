import { useCallback } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { AttachedFileRecord } from '../types/grok';
import { ThreadState } from '../stores/agentStore';
import { useAgent } from './useAgent';

async function getDefaultCwd(): Promise<string> {
  const { settings } = useWorkspaceStore.getState();
  if (settings.defaultCwd) return settings.defaultCwd;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const workspaces = await invoke<Array<{ projectDir?: string }>>('get_workspaces');
    const firstDir = workspaces.find((w) => w.projectDir)?.projectDir;
    if (firstDir) return firstDir;
  } catch { /* ignore */ }
  return '/';
}

interface UseHandleSendOpts {
  activeThread: ThreadState | null;
  status: 'idle' | 'running' | 'error';
  input: string;
  setInput: (v: string) => void;
  attachedFiles: AttachedFileRecord[];
  clearFiles: () => void;
  buildPromptWithFiles: (text: string) => string;
  startAgent: ReturnType<typeof useAgent>['startAgent'];
  resumeAgent: ReturnType<typeof useAgent>['resumeAgent'];
}

/**
 * Encapsulates the "send message" logic:
 * - Builds the CLI prompt (with injected file paths)
 * - Stores displayText + attachedFiles separately in the message
 * - Dispatches startAgent or resumeAgent depending on thread state
 */
export function useHandleSend({
  activeThread,
  status,
  input,
  setInput,
  attachedFiles,
  clearFiles,
  buildPromptWithFiles,
  startAgent,
  resumeAgent,
}: UseHandleSendOpts) {
  return useCallback(async () => {
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || status === 'running') return;

    // What the user sees in the chat bubble (never includes injected file paths)
    // Use typed text; if user sent only files with no text, use empty string (not undefined)
    // — undefined would cause the store to fall back to the full CLI prompt.
    const displayText = text;
    const hasFiles = attachedFiles.length > 0;
    // What goes to grok CLI (includes file path injection)
    const prompt = buildPromptWithFiles(text || 'Please analyze the attached file(s).');
    const filesToAttach = [...attachedFiles];

    setInput('');
    clearFiles();

    if (activeThread?.sessionId) {
      await resumeAgent({
        sessionId: activeThread.sessionId,
        message: prompt,
        // Pass empty string (not undefined) when user sent only files — prevents prompt fallback
        displayText: displayText || (hasFiles ? '' : undefined),
        attachedFiles: filesToAttach.length > 0 ? filesToAttach : undefined,
        cwd: activeThread.cwd,
        threadId: activeThread.threadId,
      });
    } else {
      const cwd = activeThread?.cwd || await getDefaultCwd();
      await startAgent({
        prompt,
        displayText: displayText || (hasFiles ? '' : undefined),
        attachedFiles: filesToAttach.length > 0 ? filesToAttach : undefined,
        cwd,
        workspaceId: activeThread?.workspaceId,
        title: activeThread?.title,
        _existingThreadId: activeThread?.threadId,
      });
    }
  }, [
    activeThread, status, input, attachedFiles,
    clearFiles, buildPromptWithFiles, startAgent, resumeAgent, setInput,
  ]);
}
