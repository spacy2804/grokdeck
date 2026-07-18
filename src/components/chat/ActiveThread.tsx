import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { ThreadState } from '../../stores/agentStore';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';
import { getActiveToolLabel } from '../../utils/chatUtils';

interface ActiveThreadProps {
  thread: ThreadState;
  onStop: () => void;
}

export function ActiveThread({ thread, onStop }: ActiveThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages]);

  const activeLabel = getActiveToolLabel(thread.messages);

  return (
    <>
      {thread.status === 'running' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 20px 0' }}>
          <button
            onClick={onStop}
            style={{
              background: 'none',
              border: '1px solid var(--slate-4)',
              borderRadius: 99,
              color: 'var(--slate-10)',
              cursor: 'pointer',
              fontSize: 12,
              padding: '3px 10px',
            }}
          >
            Stop
          </button>
        </div>
      )}

      <div className="chat-messages">
        <AnimatePresence initial={false}>
          {thread.messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageBubble
                message={msg}
                isStreaming={
                  thread.status === 'running' &&
                  msg === thread.messages[thread.messages.length - 1] &&
                  msg.role === 'assistant'
                }
                cwd={thread.cwd}
              />
            </motion.div>
          ))}

          {/* Error banner */}
          {thread.status === 'error' && thread.errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="error-banner">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{thread.errorMessage}</span>
              </div>
            </motion.div>
          )}

          {/* Dynamic streaming indicator — shown throughout entire running state */}
          {thread.status === 'running' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <StreamingIndicator label={activeLabel} />
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={endRef} />
      </div>
    </>
  );
}
