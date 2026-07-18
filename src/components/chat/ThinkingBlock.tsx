import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronRight } from 'lucide-react';

interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
}

/** Collapsible block showing the AI's chain-of-thought reasoning. */
export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="cot-step">
      <div className="cot-trigger" onClick={() => setExpanded(!expanded)}>
        <span className="cot-icon">
          {isStreaming
            ? <Loader2 size={14} className="spin" />
            : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="3" />
              </svg>
            )
          }
        </span>
        <span className="cot-label">{isStreaming ? 'Thinking…' : 'Thought'}</span>
        {!expanded && (
          <span className="cot-detail">
            {content.slice(0, 60)}{content.length > 60 ? '…' : ''}
          </span>
        )}
        <ChevronRight size={12} className={`cot-chevron ${expanded ? 'open' : ''}`} />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="cot-content">
              <p className="cot-reasoning">{content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="cot-connector" />
    </div>
  );
}
