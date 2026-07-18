import { motion, AnimatePresence } from 'framer-motion';

interface StreamingIndicatorProps {
  label: string;
}

/**
 * Shown throughout the entire AI streaming session.
 * Label animates when it changes (e.g. "Thinking…" → "Running bash…").
 */
export function StreamingIndicator({ label }: StreamingIndicatorProps) {
  return (
    <motion.div className="thinking-indicator-row" layout>
      <div className="thinking-indicator-orb" />
      <AnimatePresence mode="wait">
        <motion.span
          key={label}
          className="thinking-indicator-label"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
