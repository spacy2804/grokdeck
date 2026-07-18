import React, { useEffect, useRef } from 'react';
import { X, Paperclip, Zap } from 'lucide-react';
import { Loader2, Send } from 'lucide-react';
import { AttachedFileRecord } from '../../types/grok';
import { ThreadState } from '../../stores/agentStore';
import { FileTypeIcon } from './FileTypeIcon';
import { getTypeBadge } from '../../utils/chatUtils';

interface PromptInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  status?: ThreadState['status'];
  placeholder?: string;
  attachedFiles: AttachedFileRecord[];
  onAttachFile: () => void;
  onRemoveFile: (path: string) => void;
}

export function PromptInput({
  value, onChange, onSend, disabled, placeholder,
  attachedFiles, onAttachFile, onRemoveFile,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = !disabled && (value.trim().length > 0 || attachedFiles.length > 0);

  return (
    <div className="prompt-area">
      <div className="prompt-box">
        {/* Attached file pills */}
        {attachedFiles.length > 0 && (
          <div className="prompt-attachments">
            {attachedFiles.map((f) => (
              <div key={f.path} className="prompt-attachment-pill" title={f.path}>
                {f.type === 'image' && f.dataUri
                  ? <img src={f.dataUri} alt={f.name} className="prompt-attachment-thumb" />
                  : <span className="prompt-attachment-icon"><FileTypeIcon type={f.type} size={12} /></span>
                }
                <span className="prompt-attachment-name">{f.name}</span>
                {getTypeBadge(f.name) && (
                  <span className="prompt-attachment-badge">{getTypeBadge(f.name)}</span>
                )}
                <button
                  className="prompt-attachment-remove"
                  onClick={() => onRemoveFile(f.path)}
                  title="Remove file"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="prompt-textarea"
          placeholder={placeholder ?? 'Message Grok… (Enter to send, Shift+Enter for newline)'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />

        <div className="prompt-toolbar">
          <div className="prompt-toolbar-left">
            <button
              className={`prompt-icon-btn ${attachedFiles.length > 0 ? 'active' : ''}`}
              title="Attach file"
              onClick={onAttachFile}
              disabled={disabled}
            >
              <Paperclip size={15} />
              {attachedFiles.length > 0 && (
                <span className="prompt-attach-badge">{attachedFiles.length}</span>
              )}
            </button>
            <button className="prompt-icon-btn" title="Quick actions">
              <Zap size={15} />
            </button>
          </div>
          <button className="btn-run" onClick={onSend} disabled={!canSend}>
            {disabled
              ? <><Loader2 size={14} className="spin" /> Running…</>
              : <><Send size={13} /> Run task</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
