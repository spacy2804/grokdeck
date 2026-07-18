import { GrokLogo } from '../shared/GrokLogo';

/** Shown when no thread is selected. */
export function EmptyState() {
  return (
    <div className="chat-empty">
      <div className="chat-empty-icon"><GrokLogo size={26} /></div>
      <div className="chat-empty-title">Grok Deck</div>
      <div className="chat-empty-sub">
        Start a new task or select a session from the sidebar
      </div>
    </div>
  );
}
