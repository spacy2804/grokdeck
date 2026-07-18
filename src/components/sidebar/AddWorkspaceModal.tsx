import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FolderPlus, ChevronRight, ArrowLeft,
  Loader2, Check, FolderOpen, Tag,
} from 'lucide-react';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { WORKSPACE_COLORS } from '../../types/workspace';

type Screen = 'chooser' | 'local';

interface Props {
  onClose: () => void;
}

export default function AddWorkspaceModal({ onClose }: Props) {
  const { createWorkspace, pickDirectory } = useWorkspaces();
  const [screen, setScreen] = useState<Screen>('chooser');
  const [name, setName] = useState('');
  const [color, setColor] = useState(WORKSPACE_COLORS[4].value); // blue default
  const [projectDir, setProjectDir] = useState('');
  const [pickingFolder, setPickingFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus name when local screen opens
  useEffect(() => {
    if (screen === 'local') {
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [screen]);

  // Derive suggested name from folder path
  useEffect(() => {
    if (projectDir && !name) {
      const parts = projectDir.replace(/\\/g, '/').split('/').filter(Boolean);
      const folderName = parts[parts.length - 1];
      if (folderName) setName(folderName);
    }
  }, [projectDir]);

  const handlePickFolder = async () => {
    if (pickingFolder) return;
    setPickingFolder(true);
    try {
      const dir = await pickDirectory();
      if (dir) setProjectDir(dir);
    } finally {
      setPickingFolder(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      await createWorkspace(name.trim(), color, projectDir || undefined);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Dialog */}
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: 480,
          maxWidth: '92vw',
          maxHeight: '85vh',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '18px 20px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <AnimatePresence mode="wait" initial={false}>
            {screen !== 'chooser' ? (
              <motion.button
                key="back"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                onClick={() => setScreen('chooser')}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 6, width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ArrowLeft size={14} />
              </motion.button>
            ) : null}
          </AnimatePresence>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {screen === 'chooser' ? 'New workspace' : 'Local workspace'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              {screen === 'chooser'
                ? 'Organize your sessions by project or context'
                : 'Link to a folder on your machine'}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait" initial={false}>
            {screen === 'chooser' ? (
              <motion.div
                key="chooser"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {/* Option: local */}
                <OptionCard
                  icon={<FolderPlus size={18} />}
                  iconBg="var(--accent-dim)"
                  iconColor="var(--accent)"
                  title="Local workspace"
                  description="Link to a folder on this machine to group sessions by project."
                  onClick={() => setScreen('local')}
                />

                {/* Option: generic (no folder) */}
                <OptionCard
                  icon={<Tag size={18} />}
                  iconBg="var(--green-dim)"
                  iconColor="var(--green)"
                  title="Label workspace"
                  description="Create a named workspace without a specific project folder."
                  onClick={() => {
                    setProjectDir('');
                    setScreen('local');
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="local"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.18 }}
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'auto', maxHeight: 'calc(85vh - 140px)' }}
              >
                {/* Folder picker */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Project Folder
                  </div>
                  <button
                    onClick={handlePickFolder}
                    disabled={pickingFolder}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '12px 14px',
                      background: projectDir ? 'var(--bg-surface)' : 'var(--bg-base)',
                      border: `1px ${projectDir ? 'solid' : 'dashed'} ${projectDir ? 'var(--border-focus)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => !projectDir && (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
                    onMouseLeave={(e) => !projectDir && (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    {pickingFolder ? (
                      <Loader2 size={16} className="spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    ) : (
                      <FolderOpen size={16} style={{ color: projectDir ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: 13,
                      color: projectDir ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontFamily: projectDir ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {projectDir || 'Click to choose a folder…'}
                    </span>
                    {projectDir && (
                      <Check size={14} style={{ color: 'var(--accent)', marginLeft: 'auto', flexShrink: 0 }} />
                    )}
                  </button>
                  {projectDir && (
                    <button
                      onClick={() => { setProjectDir(''); setName(''); }}
                      style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                    >
                      Clear folder
                    </button>
                  )}
                </div>

                {/* Name */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Workspace name
                  </div>
                  <input
                    ref={nameInputRef}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Work, Side project, Experiments…"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>

                {/* Color */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Color
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {WORKSPACE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setColor(c.value)}
                        title={c.label}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: c.value,
                          border: color === c.value
                            ? '3px solid white'
                            : '3px solid transparent',
                          boxShadow: color === c.value
                            ? `0 0 0 2px ${c.value}`
                            : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          transform: color === c.value ? 'scale(1.15)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                {name && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                    {projectDir && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {projectDir.split('/').slice(-2).join('/')}
                      </span>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer (only on local screen) */}
        <AnimatePresence>
          {screen === 'local' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!name.trim() || loading}
              >
                {loading ? (
                  <><Loader2 size={13} className="spin" /> Creating…</>
                ) : (
                  'Create workspace'
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ─── Option Card ────────────────────────────────────────────── */
interface OptionCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  onClick: () => void;
}

function OptionCard({ icon, iconBg, iconColor, title, description, onClick }: OptionCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        width: '100%',
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-surface)',
        border: `1px solid ${hovered ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {/* Icon tile */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: iconColor,
        flexShrink: 0,
        transition: 'transform 0.15s',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight
        size={16}
        style={{
          color: 'var(--text-muted)',
          flexShrink: 0,
          transition: 'transform 0.15s',
          transform: hovered ? 'translateX(2px)' : 'none',
        }}
      />
    </button>
  );
}
