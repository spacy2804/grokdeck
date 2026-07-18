import { useState, useEffect, useMemo } from 'react';
import { ChatMessage } from '../types/grok';
import { DerivedArtifact, deriveMessageArtifacts } from '../utils/artifactDetection';

/**
 * Derive and verify artifacts for a single assistant message.
 *
 * - High-confidence artifacts (≥ 85, from tool call inputs) are returned immediately.
 * - Lower-confidence artifacts (< 85, from text scanning) are async-verified via
 *   the Tauri `fs.exists()` API before being surfaced to the UI.
 *
 * This prevents false positives from text scanning while still being responsive.
 */
export function useDerivedArtifacts(
  message: ChatMessage,
  cwd?: string,
): DerivedArtifact[] {
  const allArtifacts = useMemo(
    () => deriveMessageArtifacts(message, cwd ?? '/'),
    // Re-derive when tool calls or content change (i.e., during/after streaming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [message.toolCalls, message.content, message.artifacts, cwd],
  );

  const [verified, setVerified] = useState<DerivedArtifact[]>([]);

  useEffect(() => {
    if (allArtifacts.length === 0) {
      setVerified([]);
      return;
    }

    // High confidence → from reliable tool call inputs → show immediately
    const highConf = allArtifacts.filter((a) => a.confidence >= 85);
    // Low confidence → from text scanning → verify existence first
    const lowConf = allArtifacts.filter((a) => a.confidence < 85);

    // Always show high-confidence artifacts right away
    setVerified(highConf);

    if (lowConf.length === 0) return;

    let cancelled = false;

    import('@tauri-apps/plugin-fs')
      .then(async ({ exists }) => {
        const results = await Promise.all(
          lowConf.map(async (a) => {
            try {
              return (await exists(a.path)) ? a : null;
            } catch {
              return null;
            }
          }),
        );

        if (!cancelled) {
          const confirmedLow = results.filter(Boolean) as DerivedArtifact[];
          if (confirmedLow.length > 0) {
            setVerified((prev) => {
              const existing = new Set(prev.map((x) => x.id));
              const newOnes = confirmedLow.filter((a) => !existing.has(a.id));
              return newOnes.length > 0
                ? [...prev, ...newOnes].sort((a, b) => b.confidence - a.confidence)
                : prev;
            });
          }
        }
      })
      .catch(() => {
        // If fs plugin unavailable (e.g., web build), skip existence check
      });

    return () => {
      cancelled = true;
    };
  }, [allArtifacts]);

  return verified;
}
