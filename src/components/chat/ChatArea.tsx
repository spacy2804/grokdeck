import React from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useAgent } from '../../hooks/useAgent';
import { useFileAttachment } from '../../hooks/useFileAttachment';
import { useHandleSend } from '../../hooks/useHandleSend';
import { ThreadTabBar } from './ThreadTabBar';
import { ActiveThread } from './ActiveThread';
import { EmptyState } from './EmptyState';
import { PromptInput } from './PromptInput';
import ChatStatusBar from './ChatStatusBar';

interface ChatAreaProps {
  onOpenSettings?: () => void;
}

export default function ChatArea({ onOpenSettings }: ChatAreaProps) {
  const { threads, activeThreadId, closeThread, setActiveThread } = useAgentStore();
  const { startAgent, resumeAgent, stopAgent } = useAgent();
  const [input, setInput] = React.useState('');

  const activeThread = threads.find((t) => t.threadId === activeThreadId) ?? null;
  const status = activeThread?.status ?? 'idle';

  const { attachedFiles, openFilePicker, removeFile, clearFiles, buildPromptWithFiles } =
    useFileAttachment();

  const handleSend = useHandleSend({
    activeThread,
    status,
    input,
    setInput,
    attachedFiles,
    clearFiles,
    buildPromptWithFiles,
    startAgent,
    resumeAgent,
  });

  return (
    <div className="chat-pane">
      <ThreadTabBar
        threads={threads}
        activeThreadId={activeThreadId}
        onClose={closeThread}
        onSelect={setActiveThread}
        onNew={() => useAgentStore.getState().setActiveThread('')}
      />

      <div className="chat-thread-wrap">
        {activeThread
          ? <ActiveThread thread={activeThread} onStop={() => stopAgent(activeThread.threadId)} />
          : <EmptyState />
        }
      </div>

      <PromptInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={status === 'running'}
        status={status}
        placeholder={activeThread ? undefined : 'Describe your task to start a new session…'}
        attachedFiles={attachedFiles}
        onAttachFile={openFilePicker}
        onRemoveFile={removeFile}
      />

      <ChatStatusBar
        status={status as 'idle' | 'running' | 'error'}
        sessionId={activeThread?.sessionId}
        onOpenSettings={onOpenSettings ?? (() => {})}
      />
    </div>
  );
}
