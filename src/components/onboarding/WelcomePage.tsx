import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Loader2, Download,
  Code2, Terminal, FileText, Search,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { GrokLogo } from '../shared/GrokLogo';

interface ReleaseInfo {
  version: string;
  downloadUrl: string;
  sha256Url: string | null;
  size: number | null;
}

interface InstallProgress {
  stage: string;
  downloaded: number;
  total: number;
  percent: number;
  message: string;
}

interface WelcomePageProps {
  onComplete: () => void;
}

const CAPABILITIES = [
  {
    icon: <Code2 size={16} />,
    color: 'var(--accent)',
    bg: 'rgba(99,102,241,0.12)',
    title: 'Write & refactor code',
    desc: 'Edit, generate, and improve code across your project.',
  },
  {
    icon: <Terminal size={16} />,
    color: 'var(--green)',
    bg: 'var(--green-dim)',
    title: 'Run terminal commands',
    desc: 'Execute shell commands and see output in real time.',
  },
  {
    icon: <FileText size={16} />,
    color: 'var(--blue)',
    bg: 'var(--blue-dim)',
    title: 'Manage files',
    desc: 'Read, write, and organize files across directories.',
  },
  {
    icon: <Search size={16} />,
    color: 'var(--yellow)',
    bg: 'rgba(250,204,21,0.12)',
    title: 'Search & analyze',
    desc: 'Find patterns, grep code, and reason over your codebase.',
  },
];

export default function WelcomePage({ onComplete }: WelcomePageProps) {
  const { saveSettings, loadSettings } = useWorkspaces();
  const [binaryPath, setBinaryPath] = useState('');
  const [checking, setChecking] = useState(false);
  const [binaryStatus, setBinaryStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [binaryVersion, setBinaryVersion] = useState('');
  const [step, setStep] = useState<'welcome' | 'setup'>('welcome');

  // Auto-install state
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Clean up event listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  const handleAutoInstall = async () => {
    setInstalling(true);
    setInstallError(null);
    setInstallProgress({ stage: 'preparing', downloaded: 0, total: 0, percent: 0, message: 'Checking latest version...' });

    try {
      // 1. Check latest version
      const release = await invoke<ReleaseInfo>('cmd_check_latest_version');
      setLatestVersion(release.version);
      setInstallProgress({ stage: 'preparing', downloaded: 0, total: 0, percent: 0, message: `Found v${release.version}. Starting download...` });

      // 2. Listen for progress events
      const unlisten = await listen<InstallProgress>('install:progress', (event) => {
        setInstallProgress(event.payload);
      });
      unlistenRef.current = unlisten;

      // 3. Start installation
      const version = await invoke<string>('cmd_install_grok_cli', { release });

      // 4. Success
      unlisten();
      unlistenRef.current = null;
      setBinaryVersion(version);
      setBinaryStatus('ok');
      setInstalling(false);
      setInstallProgress(null);
    } catch (e) {
      setInstalling(false);
      setInstallError(String(e));
      setInstallProgress(null);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }
  };

  const handleCheckBinary = async () => {
    setChecking(true);
    setBinaryStatus('idle');
    try {
      // Save the path and check
      await saveSettings({ grokBinaryPath: binaryPath || undefined, theme: 'dark' });
      const version = await invoke<string>('check_grok_binary');
      setBinaryVersion(version);
      setBinaryStatus('ok');
    } catch (e) {
      setBinaryStatus('error');
      setBinaryVersion(String(e));
    } finally {
      setChecking(false);
    }
  };

  const handleGetStarted = async () => {
    if (step === 'welcome') {
      // Try to auto-detect grok
      setStep('setup');
      setChecking(true);
      try {
        const version = await invoke<string>('check_grok_binary');
        setBinaryVersion(version);
        setBinaryStatus('ok');
      } catch {
        setBinaryStatus('error');
      } finally {
        setChecking(false);
      }
      return;
    }

    if (binaryStatus !== 'ok') return;
    await loadSettings();
    onComplete();
  };

  return (
    <div className="onboarding-overlay">
      {/* LEFT: Steps & CTA */}
      <motion.div
        className="onboarding-left"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="onboarding-logo">
          <GrokLogo size={30} className="onboarding-logo-icon" />
          <span className="onboarding-logo-name">Grok Deck</span>
        </div>

        <div className="onboarding-content">
          <AnimatePresence mode="wait">
            {step === 'welcome' ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="onboarding-title">
                  Your AI coding<br />
                  <span style={{ color: 'var(--accent)' }}>co-pilot</span>, unlocked.
                </h1>
                <p className="onboarding-subtitle">
                  Grok Deck wraps the Grok CLI in a beautiful desktop interface.
                  Start a task and let the agent handle the rest.
                </p>

                <div className="onboarding-steps">
                  {[
                    { n: '1', title: 'Pick a folder', desc: 'Point the agent to any project directory on your machine.' },
                    { n: '2', title: 'Describe your task', desc: 'Type what you need — fix a bug, write tests, refactor code.' },
                    { n: '3', title: 'Review & iterate', desc: 'See tool calls and file changes in real time, then continue.' },
                  ].map((s) => (
                    <div key={s.n} className="onboarding-step">
                      <div className="onboarding-step-num">{s.n}</div>
                      <div className="onboarding-step-text">
                        <div className="onboarding-step-title">{s.title}</div>
                        <div className="onboarding-step-desc">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="onboarding-cta">
                  <button className="btn-onboarding-primary" onClick={handleGetStarted}>
                    Get started <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="onboarding-title">
                  Configure<br />
                  <span style={{ color: 'var(--accent)' }}>Grok CLI</span>
                </h1>
                <p className="onboarding-subtitle">
                  Grok Deck needs access to the <code style={{ fontSize: 13, background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}>grok</code> CLI binary to run agents.
                </p>

                {/* Auto-detect status */}
                <div style={{ marginBottom: 24 }}>
                  {checking ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                      <Loader2 size={14} className="spin" /> Detecting grok binary…
                    </div>
                  ) : binaryStatus === 'ok' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="status-badge ok">✓ Detected</span>
                      </div>
                      <code style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {binaryVersion}
                      </code>
                    </div>
                  ) : binaryStatus === 'error' ? (
                    <div>
                      {/* Auto-install section */}
                      {installing ? (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                            <Loader2 size={14} className="spin" />
                            <span>{installProgress?.message ?? 'Installing...'}</span>
                          </div>
                          {installProgress && installProgress.total > 0 && (
                            <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${installProgress.percent}%`,
                                  height: '100%',
                                  borderRadius: 3,
                                  background: 'var(--accent)',
                                  transition: 'width 0.2s ease',
                                }}
                              />
                            </div>
                          )}
                          {latestVersion && (
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                              Installing Grok CLI v{latestVersion}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div style={{ marginBottom: 20 }}>
                          <button
                            className="btn btn-primary"
                            onClick={handleAutoInstall}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}
                          >
                            <Download size={14} /> Install Grok CLI
                          </button>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                            Downloads the latest official binary to ~/.grok/bin/
                          </p>
                          {installError && (
                            <p style={{ fontSize: 12, color: 'var(--red, #ef4444)', marginTop: 8 }}>
                              {installError}
                            </p>
                          )}
                        </div>
                      )}

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          Or enter the path manually:
                        </p>
                        <div className="onboarding-binary-input">
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              className="form-input"
                              style={{ flex: 1 }}
                              placeholder="/usr/local/bin/grok"
                              value={binaryPath}
                              onChange={(e) => setBinaryPath(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleCheckBinary()}
                              disabled={installing}
                            />
                            <button className="btn btn-ghost" onClick={handleCheckBinary} disabled={checking || installing}>
                              Check
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="onboarding-cta">
                  <button
                    className="btn-onboarding-primary"
                    onClick={handleGetStarted}
                    disabled={binaryStatus !== 'ok' || checking}
                    style={{ opacity: binaryStatus !== 'ok' ? 0.5 : 1 }}
                  >
                    {checking ? <><Loader2 size={15} className="spin" /> Checking…</> : <>Launch Grok Deck <ArrowRight size={16} /></>}
                  </button>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
                    onClick={() => setStep('welcome')}
                  >
                    ← Back
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* RIGHT: Capability showcase */}
      <div className="onboarding-right">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div style={{ marginBottom: 28, position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.4, marginBottom: 6 }}>
              Your terminal,<br />but it thinks.
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Grok agents handle complex multi-step tasks autonomously.
            </p>
          </div>
          <div className="capability-grid">
            {CAPABILITIES.map((cap) => (
              <motion.div
                key={cap.title}
                className="capability-card"
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <div className="capability-card-icon" style={{ background: cap.bg, color: cap.color }}>
                  {cap.icon}
                </div>
                <div className="capability-card-title">{cap.title}</div>
                <div className="capability-card-desc">{cap.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
