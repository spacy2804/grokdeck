import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronRight, MessageSquare, Plus, Loader2,
  FolderOpen, MoreHorizontal, Trash2, Pencil, Settings,
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { SessionInfo, Workspace } from '../../types/workspace';
import AddWorkspaceModal from './AddWorkspaceModal';
import ConfirmModal from '../shared/ConfirmModal';
import { GrokLogo } from '../shared/GrokLogo';

interface SidebarProps {
  onSessionClick: (session: SessionInfo) => void;
  onOpenSettings: () => void;
  onNewSession: (workspaceId: string, cwd: string) => void;
  activeThreadSessionId?: string;
}

export default function Sidebar({ onSessionClick, onOpenSettings, onNewSession, activeThreadSessionId }: SidebarProps) {
  const { workspaces, sessions, isLoadingSessions } = useWorkspaceStore();
  const { searchSessions, loadSessions, deleteWorkspace, loadWorkspaces, deleteSession } = useWorkspaces();
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'session' | 'workspace'; id: string; title: string } | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(() => {
    // Expand all workspaces by default
    return new Set(workspaces.map((w) => w.id));
  });

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim()) searchSessions(q);
    else loadSessions();
  };

  const toggleWorkspace = (id: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Assign ungrouped sessions to the first workspace (Default)
  const defaultWorkspace = workspaces[0];
  const grouped = workspaces.map((ws) => ({
    workspace: ws,
    sessions: sessions.filter((s) => {
      if (s.workspaceId === ws.id) return true;
      // Orphan sessions go to the first (Default) workspace
      if (!s.workspaceId && ws.id === defaultWorkspace?.id) return true;
      return false;
    }),
  }));

  const sessionTitle = (s: SessionInfo) =>
    s.summary || s.firstPrompt?.slice(0, 50) || s.sessionId.slice(0, 12);

  return (
    <aside className="ow-sidebar">
      {/* Header / Logo */}
      <div className="ow-sidebar-header">
        <GrokLogo size={20} />
        <span className="ow-sidebar-app-name">Grok Deck</span>
        <button
          className="ow-sidebar-settings-btn"
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="ow-sidebar-search-wrap">
        <div className="ow-sidebar-search-inner">
          <Search size={12} className="ow-sidebar-search-icon" />
          <input
            className="ow-sidebar-search-input"
            type="text"
            placeholder="Search sessions…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Session list */}
      <div className="ow-sidebar-body">

        {/* Loading */}
        {isLoadingSessions && (
          <div className="ow-sidebar-loading">
            <Loader2 size={14} className="spin" />
          </div>
        )}

        {/* Workspace groups */}
        {grouped.map(({ workspace: ws, sessions: wsSessions }) => (
          <WorkspaceGroup
            key={ws.id}
            workspace={ws}
            sessions={wsSessions}
            expanded={expandedWorkspaces.has(ws.id)}
            onToggle={() => toggleWorkspace(ws.id)}
            onSessionClick={onSessionClick}
            activeSessionId={activeThreadSessionId}
            sessionTitle={sessionTitle}
            onNewSession={() => {
              onNewSession(ws.id, ws.projectDir || '/');
            }}
            onDeleteWorkspace={() => {
              setConfirmDelete({ type: 'workspace', id: ws.id, title: ws.name });
            }}
            onDeleteSession={(s) => {
              setConfirmDelete({ type: 'session', id: s.sessionId, title: sessionTitle(s) });
            }}
          />
        ))}

        {/* Empty state */}
        {!isLoadingSessions && grouped.every(g => g.sessions.length === 0) && (
          <div className="ow-sidebar-empty">
            <MessageSquare size={18} />
            <span>No sessions yet</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="ow-sidebar-footer">
        <button
          className="ow-sidebar-footer-btn"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={13} />
          <span>Add workspace</span>
        </button>
      </div>

      {showAddModal && (
        <AddWorkspaceModal onClose={() => { setShowAddModal(false); loadWorkspaces(); }} />
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmModal
            title={confirmDelete.type === 'session' ? 'Delete session' : 'Delete workspace'}
            description={
              confirmDelete.type === 'session'
                ? `Are you sure you want to delete "${confirmDelete.title}"? This action cannot be undone.`
                : `Delete workspace "${confirmDelete.title}"? Sessions inside will not be deleted.`
            }
            confirmLabel="Delete"
            onConfirm={async () => {
              if (confirmDelete.type === 'session') {
                await deleteSession(confirmDelete.id);
                await loadSessions();
              } else {
                await deleteWorkspace(confirmDelete.id);
                await loadWorkspaces();
              }
              setConfirmDelete(null);
            }}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}

/* ─── Workspace Group ────────────────────────────────────────── */
function WorkspaceGroup({
  workspace,
  sessions,
  expanded,
  onToggle,
  onSessionClick,
  activeSessionId,
  sessionTitle,
  onNewSession,
  onDeleteWorkspace,
  onDeleteSession,
}: {
  workspace: Workspace;
  sessions: SessionInfo[];
  expanded: boolean;
  onToggle: () => void;
  onSessionClick: (s: SessionInfo) => void;
  activeSessionId?: string;
  sessionTitle: (s: SessionInfo) => string;
  onNewSession: () => void;
  onDeleteWorkspace: () => void;
  onDeleteSession: (s: SessionInfo) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div className="ow-ws-group">
      {/* Group header */}
      <div className="ow-ws-group-header" onClick={onToggle}>
        <div className="ow-ws-dot" style={{ background: workspace.color }} />
        <span className="ow-ws-group-name">{workspace.name}</span>
        <div className="ow-ws-group-right">
          <button
            className="ow-ws-more-btn"
            title="Workspace options"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          >
            <MoreHorizontal size={13} />
          </button>
          <ChevronRight
            size={12}
            className={`ow-ws-group-chevron ${expanded ? 'open' : ''}`}
          />
        </div>
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            ref={menuRef}
            className="ow-context-menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            onMouseLeave={() => setShowMenu(false)}
          >
            <button
              className="ow-context-menu-item"
              onClick={() => { setShowMenu(false); onNewSession(); }}
            >
              <Plus size={13} />
              New session
            </button>
            {workspace.projectDir && (
              <button className="ow-context-menu-item" onClick={() => setShowMenu(false)}>
                <FolderOpen size={13} />
                Open folder
              </button>
            )}
            <button className="ow-context-menu-item" onClick={() => setShowMenu(false)}>
              <Pencil size={13} />
              Rename
            </button>
            <div className="ow-context-menu-separator" />
            <button
              className="ow-context-menu-item danger"
              onClick={() => { setShowMenu(false); onDeleteWorkspace(); }}
            >
              <Trash2 size={13} />
              Delete workspace
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sessions */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="ow-ws-sessions">
              {sessions.length === 0 ? (
                <div className="ow-ws-empty">No sessions yet</div>
              ) : (
                sessions.map((s) => (
                  <SessionItem
                    key={s.sessionId}
                    session={s}
                    title={sessionTitle(s)}
                    isActive={s.sessionId === activeSessionId}
                    onClick={() => onSessionClick(s)}
                    onDelete={() => onDeleteSession(s)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Session Item ───────────────────────────────────────────── */
function SessionItem({
  session,
  title,
  isActive,
  onClick,
  onDelete,
}: {
  session: SessionInfo;
  title: string;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const formatDate = (ts?: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Close menu on outside click
  const handleBlur = () => {
    setTimeout(() => {
      if (menuRef.current && !menuRef.current.contains(document.activeElement)) {
        setMenuOpen(false);
      }
    }, 100);
  };

  return (
    <div
      className={`ow-session-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={title}
    >
      <MessageSquare size={12} className="ow-session-icon" />
      <span className="ow-session-title">{title}</span>
      {session.updatedAt && !menuOpen && (
        <span className="ow-session-date">{formatDate(session.updatedAt)}</span>
      )}
      {/* More button — visible on hover */}
      <button
        className="ow-session-more-btn"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        onBlur={handleBlur}
        title="Session options"
      >
        <MoreHorizontal size={14} />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            className="ow-session-menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ow-context-menu-item danger"
              onClick={() => { setMenuOpen(false); onDelete(); }}
            >
              <Trash2 size={13} />
              Delete session
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
