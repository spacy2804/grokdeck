import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';
import { ThreadState } from '../../stores/agentStore';

interface ThreadTabBarProps {
  threads: ThreadState[];
  activeThreadId: string | null;
  onClose: (id: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ThreadTabBar({ threads, activeThreadId, onClose, onSelect, onNew }: ThreadTabBarProps) {
  return (
    <div className="thread-tabs">
      <AnimatePresence initial={false}>
        {threads.map((t) => (
          <motion.div
            key={t.threadId}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className={`thread-tab ${t.threadId === activeThreadId ? 'active' : ''}`}
            onClick={() => onSelect(t.threadId)}
          >
            <span className="thread-tab-title">{t.title}</span>
            {t.status === 'running' && (
              <Loader2 size={11} className="spin" style={{ color: 'var(--blue)' }} />
            )}
            <span
              className="thread-tab-close"
              onClick={(e) => { e.stopPropagation(); onClose(t.threadId); }}
            >
              <X size={11} />
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="thread-tab-new" onClick={onNew} title="New chat">
        <Plus size={14} />
      </div>
    </div>
  );
}
