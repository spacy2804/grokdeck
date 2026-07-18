import { BookOpen, MessageCircleMore, Settings } from 'lucide-react';

const DOCS_URL = 'https://docs.x.ai/build/overview';
const FEEDBACK_URL = 'https://github.com/xai-org/grok-build/issues';

async function openLink(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    try { window.open(url, '_blank'); } catch { /* ignore */ }
  }
}

interface ChatStatusBarProps {
  status: 'idle' | 'running' | 'error';
  sessionId?: string;
  onOpenSettings: () => void;
}

export default function ChatStatusBar({ status, onOpenSettings }: ChatStatusBarProps) {
  return (
    <div className="ow-status-bar">
      {/* Left: status indicator */}
      <div className="ow-status-bar-left">
        <div className={`ow-status-indicator ${status}`}>
          <div className="ow-status-dot-wrap">
            {status === 'running' ? (
              <>
                <div className="ow-dot ow-dot-ticker" />
                <div className="ow-dot ow-dot-ticker" />
                <div className="ow-dot ow-dot-ticker" />
              </>
            ) : (
              <div className={`ow-status-dot-single ${status}`} />
            )}
          </div>
          <span className="ow-status-label">
            {status === 'running' ? 'Agent running' : status === 'error' ? 'Error' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Right: Docs, Feedback, Settings */}
      <div className="ow-status-bar-right">
        <button
          className="ow-status-btn"
          onClick={() => openLink(DOCS_URL)}
          title="Open documentation"
        >
          <BookOpen size={13} />
          <span>Docs</span>
        </button>
        <button
          className="ow-status-btn"
          onClick={() => openLink(FEEDBACK_URL)}
          title="Send feedback"
        >
          <MessageCircleMore size={13} />
          <span>Feedback</span>
        </button>
        <div className="ow-status-sep" />
        <button
          className="ow-status-btn icon-only"
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings size={13} />
        </button>
      </div>
    </div>
  );
}
