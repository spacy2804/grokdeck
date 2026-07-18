import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Terminal, Palette, FolderOpen, Info, LogOut, User,
  Check, Loader2, Trash2, Plus,
  ChevronRight,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { Settings } from '../../types/workspace';
import AddWorkspaceModal from '../sidebar/AddWorkspaceModal';

type NavSection = 'general' | 'account' | 'appearance' | 'workspaces' | 'about';

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ReactNode }[] = [
  { id: 'general',     label: 'General',     icon: <Terminal size={14} /> },
  { id: 'account',     label: 'Account',     icon: <User size={14} /> },
  { id: 'appearance',  label: 'Appearance',  icon: <Palette size={14} /> },
  { id: 'workspaces',  label: 'Workspaces',  icon: <FolderOpen size={14} /> },
  { id: 'about',       label: 'About',       icon: <Info size={14} /> },
];

interface SettingsPageProps {
  onClose: () => void;
  onSignOut?: () => void;
}

export default function SettingsPage({ onClose, onSignOut }: SettingsPageProps) {
  const [active, setActive] = useState<NavSection>('general');
  const { settings, loadSettings, saveSettings, loadWorkspaces, deleteWorkspace, pickDirectory } = useWorkspaces();
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);

  useEffect(() => {
    loadSettings();
    loadWorkspaces();
  }, []);

  return (
    <>
      <motion.div
        className="settings-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {/* Left nav */}
        <nav className="settings-sidebar">
          <button className="settings-back-btn" onClick={onClose}>
            <ArrowLeft size={14} />
            <span>Back to app</span>
          </button>
          <div className="settings-nav-header">Settings</div>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`settings-nav-item ${active === item.id ? 'active' : ''}`}
              onClick={() => setActive(item.id)}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </nav>

        {/* Content */}
        <div className="settings-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {active === 'general' && (
                <GeneralSection
                  settings={settings}
                  onSave={saveSettings}
                  onPickDir={pickDirectory}
                />
              )}
              {active === 'account' && (
                <AccountSection onSignOut={onSignOut} />
              )}
              {active === 'appearance' && (
                <AppearanceSection settings={settings} onSave={saveSettings} />
              )}
              {active === 'workspaces' && (
                <WorkspacesSection
                  onAddWorkspace={() => setShowAddWorkspace(true)}
                  onDeleteWorkspace={deleteWorkspace}
                />
              )}
              {active === 'about' && <AboutSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {showAddWorkspace && (
        <AddWorkspaceModal onClose={() => { setShowAddWorkspace(false); loadWorkspaces(); }} />
      )}
    </>
  );
}

/* ─── General Section ────────────────────────────────────────── */
function GeneralSection({
  settings,
  onSave,
  onPickDir,
}: {
  settings: Settings;
  onSave: (s: Settings) => Promise<void>;
  onPickDir: () => Promise<string | null>;
}) {
  const [binaryPath, setBinaryPath] = useState(settings.grokBinaryPath ?? '');
  const [defaultCwd, setDefaultCwd] = useState(settings.defaultCwd ?? '');
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel ?? '');
  const [checking, setChecking] = useState(false);
  const [binaryStatus, setBinaryStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [binaryVersion, setBinaryVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBinaryPath(settings.grokBinaryPath ?? '');
    setDefaultCwd(settings.defaultCwd ?? '');
    setDefaultModel(settings.defaultModel ?? '');
  }, [settings]);

  const handleCheckBinary = async () => {
    setChecking(true);
    setBinaryStatus('idle');
    try {
      await onSave({ ...settings, grokBinaryPath: binaryPath || undefined });
      const version = await invoke<string>('check_grok_binary');
      setBinaryVersion(version);
      setBinaryStatus('ok');
    } catch (e) {
      setBinaryVersion(String(e));
      setBinaryStatus('error');
    } finally {
      setChecking(false);
    }
  };

  const handlePickCwd = async () => {
    const dir = await onPickDir();
    if (dir) setDefaultCwd(dir);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...settings,
        grokBinaryPath: binaryPath || undefined,
        defaultCwd: defaultCwd || undefined,
        defaultModel: defaultModel || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="settings-page-title">General</div>
      <div className="settings-page-desc">Configure the Grok CLI path and default agent behavior.</div>

      {/* Grok binary */}
      <div className="settings-section">
        <div className="settings-section-title">Grok CLI</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-title">Binary path</div>
            <div className="settings-row-desc">
              Path to the <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>grok</code> executable.
              Leave empty to use <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>$PATH</code>.
            </div>
          </div>
        </div>

        <div className="settings-input-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder="/usr/local/bin/grok  (leave blank for auto-detect)"
              value={binaryPath}
              onChange={(e) => { setBinaryPath(e.target.value); setBinaryStatus('idle'); }}
            />
            <button
              className="btn btn-ghost"
              onClick={handleCheckBinary}
              disabled={checking}
              style={{ whiteSpace: 'nowrap' }}
            >
              {checking ? <Loader2 size={13} className="spin" /> : 'Verify'}
            </button>
          </div>

          {/* Status */}
          {binaryStatus === 'ok' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="status-badge ok"><Check size={11} /> Verified</span>
              <code style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                {binaryVersion}
              </code>
            </div>
          )}
          {binaryStatus === 'error' && (
            <span className="status-badge error">✗ {binaryVersion.split('\n')[0]}</span>
          )}
        </div>
      </div>

      {/* Default working directory */}
      <div className="settings-section">
        <div className="settings-section-title">Defaults</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-title">Default working directory</div>
            <div className="settings-row-desc">Used when starting a new session without a workspace folder.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="~/ (home directory)"
            value={defaultCwd}
            onChange={(e) => setDefaultCwd(e.target.value)}
          />
          <button className="btn btn-ghost" onClick={handlePickCwd}>Browse</button>
        </div>

        <div>
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-title">Default model</div>
              <div className="settings-row-desc">Model ID passed to <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>grok --model</code>. Leave blank to use grok's default.</div>
            </div>
          </div>
          <input
            className="form-input"
            style={{ width: '100%', marginTop: 8 }}
            placeholder="e.g. grok-3, grok-3-mini…"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
          />
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saved ? <><Check size={13} /> Saved</> : saving ? <><Loader2 size={13} className="spin" /> Saving…</> : 'Save changes'}
        </button>
      </div>
    </>
  );
}

/* ─── Appearance Section ─────────────────────────────────────── */
function AppearanceSection({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (s: Settings) => Promise<void>;
}) {
  const [theme, setTheme] = useState<Settings['theme']>(settings.theme ?? 'dark');

  const applyTheme = (t: Settings['theme']) => {
    // Determine effective theme
    const effective = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : t;
    // Apply to root element
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${effective}`);
  };

  const handleThemeChange = async (t: Settings['theme']) => {
    setTheme(t);
    applyTheme(t);
    await onSave({ ...settings, theme: t });
  };

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, []);

  return (
    <>
      <div className="settings-page-title">Appearance</div>
      <div className="settings-page-desc">Customize how Grok Deck looks.</div>

      <div className="settings-section">
        <div className="settings-section-title">Theme</div>
        <p style={{ fontSize: 13, color: 'var(--slate-10)', marginBottom: 12 }}>
          Select a color theme for the interface.
        </p>

        <div className="theme-picker">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              className={`theme-picker-item ${theme === t ? 'active' : ''}`}
              onClick={() => handleThemeChange(t)}
            >
              <div className={`theme-preview theme-preview-${t}`}>
                {t === 'system' && (
                  <div className="theme-preview-split">
                    <div className="theme-preview-split-light" />
                    <div className="theme-preview-split-dark" />
                  </div>
                )}
              </div>
              <span className="theme-picker-label">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--slate-9)', marginTop: 8 }}>
          "System" follows your operating system preference.
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Interface</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-title">Compact mode</div>
            <div className="settings-row-desc">Reduce padding and font sizes across the interface.</div>
          </div>
          <div className="settings-row-control">
            <Toggle checked={false} onChange={() => {}} />
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-title">Show tool call details</div>
            <div className="settings-row-desc">Expand tool call cards by default in chat.</div>
          </div>
          <div className="settings-row-control">
            <Toggle checked={true} onChange={() => {}} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Workspaces Section ─────────────────────────────────────── */
function WorkspacesSection({
  onAddWorkspace,
  onDeleteWorkspace,
}: {
  onAddWorkspace: () => void;
  onDeleteWorkspace: (id: string) => Promise<void>;
}) {
  const { workspaces } = useWorkspaceStore();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workspace? Sessions will not be deleted.')) return;
    setDeleting(id);
    try {
      await onDeleteWorkspace(id);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div className="settings-page-title">Workspaces</div>
          <div className="settings-page-desc">Manage your workspaces and their linked project folders.</div>
        </div>
        <button className="btn btn-primary" onClick={onAddWorkspace} style={{ flexShrink: 0 }}>
          <Plus size={14} /> New workspace
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Your workspaces ({workspaces.length})</div>

        {workspaces.length === 0 ? (
          <div style={{
            padding: '32px 0',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            <FolderOpen size={32} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
            <div>No workspaces yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Create one to organize your sessions by project.</div>
          </div>
        ) : (
          <div className="workspace-list">
            {workspaces.map((ws) => (
              <motion.div
                key={ws.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="workspace-list-item"
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: ws.color, flexShrink: 0 }} />
                <span className="workspace-list-name">{ws.name}</span>
                {ws.projectDir && (
                  <span className="workspace-list-dir">{ws.projectDir}</span>
                )}
                <div className="workspace-list-actions">
                  <button
                    className="btn-icon-sm danger"
                    onClick={() => handleDelete(ws.id)}
                    disabled={deleting === ws.id}
                    title="Delete workspace"
                  >
                    {deleting === ws.id
                      ? <Loader2 size={13} className="spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── About Section ──────────────────────────────────────────── */
function AboutSection() {
  return (
    <>
      <div className="settings-page-title">About</div>
      <div className="settings-page-desc">Grok Deck — Desktop GUI for the Grok Build CLI.</div>

      <div className="settings-section">
        <div className="settings-section-title">Version</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{
            width: 44,
            height: 44,
            background: 'var(--accent)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 20,
            color: 'white',
            boxShadow: '0 0 20px rgba(99,102,241,0.3)',
          }}>G</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Grok Deck</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>v0.1.0</div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Links</div>
        {[
          { label: 'Grok Deck repository', url: 'https://github.com/spacy2804/grokdeck' },
          { label: 'Report an issue', url: 'https://github.com/spacy2804/grokdeck/issues' },
        ].map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: 13,
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            {link.label}
            <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </a>
        ))}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Data</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-title">Config directory</div>
            <div className="settings-row-desc" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              ~/.grokdeck/
            </div>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <div className="settings-row-title">Grok sessions</div>
            <div className="settings-row-desc" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              ~/.grok/sessions/
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Account Section ─────────────────────────────────────────── */
interface AuthCheckResult {
  authenticated: boolean;
  method: string;
  detail: string | null;
}

function AccountSection({ onSignOut }: { onSignOut?: () => void }) {
  const [authStatus, setAuthStatus] = useState<AuthCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    invoke<AuthCheckResult>('check_auth_status')
      .then(setAuthStatus)
      .catch(() => setAuthStatus({ authenticated: false, method: 'none', detail: null }))
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // Run `grok logout` via the backend
      await invoke('trigger_grok_logout');
    } catch {
      // Fallback: even if command fails, clear local state
    }
    setSigningOut(false);
    setAuthStatus({ authenticated: false, method: 'none', detail: null });
    onSignOut?.();
  };

  return (
    <>
      <div className="settings-page-title">Account</div>
      <div className="settings-page-desc">Manage your Grok authentication.</div>

      <div className="settings-section">
        <div className="settings-section-title">Authentication</div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--slate-10)', fontSize: 13 }}>
            <Loader2 size={14} className="spin" /> Checking auth status…
          </div>
        ) : authStatus?.authenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: '50%',
                background: 'var(--slate-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600, color: 'var(--slate-11)',
                flexShrink: 0,
              }}>
                <User size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dls-text-primary)' }}>
                  Signed in
                </div>
                <div style={{ fontSize: 12, color: 'var(--slate-10)' }}>
                  {authStatus.method === 'api_key' ? 'Using API key' : authStatus.detail ?? 'Browser session'}
                </div>
              </div>
            </div>
            <button
              className="btn btn-ghost"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{ flexShrink: 0 }}
            >
              {signingOut ? (
                <><Loader2 size={13} className="spin" /> Signing out…</>
              ) : (
                <><LogOut size={13} /> Sign out</>
              )}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: '50%',
                background: 'var(--red-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <User size={16} style={{ color: 'var(--red-11)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dls-text-primary)' }}>
                  Not signed in
                </div>
                <div style={{ fontSize: 12, color: 'var(--slate-10)' }}>
                  Sign in to use Grok agents.
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await invoke('trigger_grok_login');
                  const result = await invoke<AuthCheckResult>('check_auth_status');
                  setAuthStatus(result);
                } catch { /* user may cancel */ }
              }}
              style={{ flexShrink: 0 }}
            >
              Sign in
            </button>
          </div>
        )}
      </div>

      {authStatus?.authenticated && authStatus.method === 'api_key' && (
        <div className="settings-section">
          <div className="settings-section-title">Note</div>
          <div style={{ fontSize: 13, color: 'var(--slate-10)', lineHeight: 1.55 }}>
            You are authenticated via the <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--slate-3)', padding: '1px 5px', borderRadius: 4, color: 'var(--blue-11)' }}>XAI_API_KEY</code> environment variable.
            Signing out will not revoke API key access — remove the variable from your environment instead.
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Toggle Component ───────────────────────────────────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  );
}
