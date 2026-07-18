import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2, ChevronRight } from 'lucide-react';
import { ToolCallRecord } from '../../types/grok';

interface ToolCallCardProps {
  tool: ToolCallRecord;
}

/** Collapsible card showing a single tool invocation and its output. */
export function ToolCallCard({ tool }: ToolCallCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  const inputStr =
    typeof tool.input === 'object' && 'command' in tool.input
      ? String(tool.input.command)
      : typeof tool.input === 'object' && 'query' in tool.input
        ? String(tool.input.query)
        : JSON.stringify(tool.input, null, 2);

  return (
    <div className="cot-step">
      <div className="cot-trigger" onClick={() => setExpanded(!expanded)}>
        <span className="cot-icon">
          {tool.status === 'pending'
            ? <Loader2 size={14} className="spin" />
            : <Zap size={14} />
          }
        </span>
        <span className="cot-label">{tool.name}</span>
        <span className="cot-detail">
          {inputStr.slice(0, 60)}{inputStr.length > 60 ? '…' : ''}
        </span>
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
              <pre className="cot-pre">$ {inputStr}</pre>
              {tool.output && <pre className="cot-output">{tool.output}</pre>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="cot-connector" />
    </div>
  );
}
