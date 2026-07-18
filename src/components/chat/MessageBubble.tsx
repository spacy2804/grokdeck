import React, { useMemo } from 'react';
import { Copy, Check, ArrowUpRight } from 'lucide-react';
import { ChatMessage, AttachedFileRecord, getFileAttachmentType } from '../../types/grok';
import { Markdown } from '../shared/Markdown';
import { usePreviewStore } from '../../stores/previewStore';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import { FileTypeIcon } from './FileTypeIcon';
import { toPreviewTabType, getTypeBadge } from '../../utils/chatUtils';
import { useDerivedArtifacts } from '../../hooks/useDerivedArtifacts';

// ── User message content parser ───────────────────────────────────
// Backend stores the full CLI prompt (with injected file paths).
// On session restore, we need to split these apart so we can
// display the typed text separately from reconstructed file pills.

const FILE_INJECTION_MARKER = '\n\nPlease use the following file(s):\n';

function parseUserContent(content: string): {
  displayText: string;
  injectedPaths: string[];
} {
  const idx = content.indexOf(FILE_INJECTION_MARKER);
  if (idx === -1) return { displayText: content, injectedPaths: [] };
  const displayText = content.slice(0, idx);
  const pathSection = content.slice(idx + FILE_INJECTION_MARKER.length);
  const injectedPaths = pathSection.split('\n').map((p) => p.trim()).filter(Boolean);
  return { displayText, injectedPaths };
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming: boolean;
  cwd?: string;
}

export function MessageBubble({ message, isStreaming, cwd }: MessageBubbleProps) {
  const { openArtifact } = usePreviewStore();
  const [copied, setCopied] = React.useState(false);
  const derivedArtifacts = useDerivedArtifacts(message, cwd);

  // For user messages: separate displayText from injected file paths
  const { displayText, injectedPaths } = useMemo(
    () => message.role === 'user' ? parseUserContent(message.content) : { displayText: message.content, injectedPaths: [] },
    [message.role, message.content],
  );

  // Files to show as pills:
  // - Prefer actual attachedFiles (new messages — have dataUri for images)
  // - Fall back to paths reconstructed from CLI injection (restored messages)
  const filesToShow: AttachedFileRecord[] = useMemo(() => {
    if (message.attachedFiles.length > 0) return message.attachedFiles;
    if (injectedPaths.length === 0) return [];
    return injectedPaths.map((path) => ({
      path,
      name: path.split('/').pop() ?? path,
      type: getFileAttachmentType(path.split('/').pop() ?? path),
    }));
  }, [message.attachedFiles, injectedPaths]);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className={`message-row ${message.role}`}>
      <div className="message-body">
        {/* User: file pills — actual attachedFiles or reconstructed from injected paths */}
        {message.role === 'user' && filesToShow.length > 0 && (
          <UserFileAttachments files={filesToShow} />
        )}

        {/* Tool calls + reasoning steps */}
        {(message.toolCalls.length > 0 || message.thinking) && (
          <div className="cot-steps-container">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} tool={tc} />
            ))}
            {message.thinking && (
              <ThinkingBlock content={message.thinking} isStreaming={isStreaming && !message.content} />
            )}
          </div>
        )}

        {/* Text content — for user: displayText (stripped of injected paths) */}
        {displayText && (
          <div className={`message-bubble ${message.role}`}>
            {message.role === 'assistant'
              ? <Markdown cwd={cwd}>{displayText}</Markdown>
              : <span style={{ whiteSpace: 'pre-wrap' }}>{displayText}</span>
            }
            {isStreaming && <span className="message-streaming-cursor" />}
          </div>
        )}

        {/* Assistant: all derived artifacts (from tools + text) */}
        {derivedArtifacts.length > 0 && (
          <div className="artifact-list">
            {derivedArtifacts.map((a) => (
              <button
                key={a.id}
                className="artifact-pill"
                onClick={() => openArtifact(a.path, a.name, a.previewType)}
              >
                <FileTypeIcon type={a.previewType === 'image' ? 'image' : a.previewType === 'csv' ? 'sheet' : 'text'} size={12} />
                <span className="artifact-pill-name">{a.name}</span>
                <ArrowUpRight size={11} className="artifact-pill-arrow" />
              </button>
            ))}
          </div>
        )}

        {/* Copy button — visible on hover */}
        {!isStreaming && message.content && (
          <div className="message-actions">
            <button className="message-action-btn" onClick={handleCopy} title={copied ? 'Copied!' : 'Copy'}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── User File Attachments ────────────────────────────────────────

interface UserFileAttachmentsProps {
  files: AttachedFileRecord[];
}

function UserFileAttachments({ files }: UserFileAttachmentsProps) {
  const { openArtifact } = usePreviewStore();

  return (
    <div className="msg-file-list">
      {files.map((file) => {
        const openPreview = () =>
          openArtifact(file.path, file.name, toPreviewTabType(file.name, file.type));

        if (file.type === 'image') {
          return (
            <div
              key={file.path}
              className="msg-file-image-wrap"
              onClick={openPreview}
              title={`Click to preview: ${file.name}`}
            >
              {file.dataUri
                ? <img src={file.dataUri} alt={file.name} className="msg-file-image" />
                : (
                  <div className="msg-file-image-placeholder">
                    <FileTypeIcon type="image" size={24} />
                  </div>
                )
              }
              <div className="msg-file-image-caption">{file.name}</div>
            </div>
          );
        }

        return (
          <button
            key={file.path}
            className="msg-file-pill"
            onClick={openPreview}
            title={file.path}
          >
            <span className="msg-file-pill-icon">
              <FileTypeIcon type={file.type} size={14} />
            </span>
            <span className="msg-file-pill-name">{file.name}</span>
            {getTypeBadge(file.name) && (
              <span className="msg-file-pill-badge">{getTypeBadge(file.name)}</span>
            )}
            <ArrowUpRight size={11} className="msg-file-pill-arrow" />
          </button>
        );
      })}
    </div>
  );
}
