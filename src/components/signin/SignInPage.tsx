import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, Loader2, CheckCircle2, AlertCircle,
  Code2, Terminal, FileText, Search, Zap, Globe, Copy, Check,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { GrokLogo } from '../shared/GrokLogo';

interface SignInPageProps {
  onAuthenticated: () => void;
}

interface AuthCheckResult {
  authenticated: boolean;
  method: string;
  detail: string | null;
}

const capabilities = [
  {
    icon: <Code2 size={16} />,
    color: 'var(--accent)',
    bg: 'rgba(0,144,255,0.10)',
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
  {
    icon: <Zap size={16} />,
    color: 'var(--accent)',
    bg: 'rgba(0,144,255,0.10)',
    title: 'Automate tasks',
    desc: 'Build reusable workflows and handle multi-step operations.',
  },
  {
    icon: <Globe size={16} />,
    color: 'var(--green)',
    bg: 'var(--green-dim)',
    title: 'Search the web',
    desc: 'Look up documentation, APIs, and solutions in real time.',
  },
];

/** Try to extract a short alphanumeric device code from a line of text */
function extractDeviceCode(line: string): string | null {
  // Match patterns like "XXXX-XXXX", "XXXXXXXX", or standalone uppercase codes
  const match = line.match(/\b([A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{8,})\b/);
  return match ? match[1] : null;
}

export default function SignInPage({ onAuthenticated }: SignInPageProps) {
  const [status, setStatus] = useState<'idle' | 'signing_in' | 'checking' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loginOutput, setLoginOutput] = useState<string[]>([]);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => { unlistenRef.current?.(); };
  }, []);

  const handleCopyCode = () => {
    if (!deviceCode) return;
    navigator.clipboard.writeText(deviceCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSignIn = async () => {
    setStatus('signing_in');
    setErrorMessage(null);
    setStatusMessage('Opening browser for sign in…');
    setLoginOutput([]);
    setDeviceCode(null);

    // Subscribe to auth:output events BEFORE invoking
    unlistenRef.current?.();
    unlistenRef.current = await listen<string>('auth:output', (e) => {
      const line = e.payload.trim();
      if (!line) return;
      setLoginOutput((prev) => [...prev, line]);
      // Try to detect device code in this line
      const code = extractDeviceCode(line);
      if (code) setDeviceCode(code);
    });

    try {
      await invoke('trigger_grok_login');
      // Login completed — re-check auth
      unlistenRef.current?.();
      unlistenRef.current = null;
      setStatusMessage('Verifying credentials…');
      setStatus('checking');
      const result = await invoke<AuthCheckResult>('check_auth_status');
      if (result.authenticated) {
        onAuthenticated();
      } else {
        setStatus('error');
        setErrorMessage('Sign in was not completed. Please try again.');
      }
    } catch (e) {
      unlistenRef.current?.();
      unlistenRef.current = null;
      setStatus('error');
      setErrorMessage(String(e));
    }
  };

  const handleRetryCheck = async () => {
    setStatus('checking');
    setErrorMessage(null);
    setStatusMessage('Checking credentials…');
    try {
      const result = await invoke<AuthCheckResult>('check_auth_status');
      if (result.authenticated) {
        onAuthenticated();
      } else {
        setStatus('idle');
        setStatusMessage(null);
      }
    } catch {
      setStatus('idle');
      setStatusMessage(null);
    }
  };

  return (
    <div className="signin-page">
      {/* Subtle background blurs */}
      <div className="signin-bg-blur signin-bg-blur-1" />
      <div className="signin-bg-blur signin-bg-blur-2" />
      <div className="signin-bg-blur signin-bg-blur-3" />

      <div className="signin-layout">
        {/* LEFT: Sign in form */}
        <motion.div
          className="signin-left"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="signin-left-inner">
            {/* Logo */}
            <div className="signin-logo">
              <GrokLogo size={28} className="signin-logo-icon" />
              <span className="signin-logo-name">Grok Deck</span>
            </div>

            {/* Header */}
            <div className="signin-header">
              <h1 className="signin-title">Welcome to Grok Deck</h1>
              <p className="signin-subtitle">
                Sign in to get started with your workspace.
              </p>
            </div>

            {/* Primary CTA */}
            <button
              className="signin-primary-btn"
              onClick={handleSignIn}
              disabled={status === 'signing_in' || status === 'checking'}
            >
              {status === 'signing_in' || status === 'checking' ? (
                <>
                  <Loader2 size={15} className="spin" />
                  {status === 'signing_in' ? 'Waiting for browser…' : 'Verifying…'}
                </>
              ) : (
                <>
                  Sign in to Grok Deck
                  <ArrowUpRight size={15} />
                </>
              )}
            </button>

            {/* Status message */}
            {statusMessage && !errorMessage && (
              <div className="signin-notice">
                {statusMessage}
              </div>
            )}

            {/* Device code — highlighted prominently */}
            {deviceCode && (
              <motion.div
                className="signin-device-code-box"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="signin-device-code-label">
                  Enter this code in your browser:
                </div>
                <div className="signin-device-code-row">
                  <span className="signin-device-code">{deviceCode}</span>
                  <button
                    className="signin-device-code-copy"
                    onClick={handleCopyCode}
                    title="Copy code"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Login output terminal */}
            {loginOutput.length > 0 && (
              <div className="signin-login-output">
                {loginOutput.map((line, i) => (
                  <div
                    key={i}
                    className={`signin-login-line ${extractDeviceCode(line) ? 'signin-login-line-code' : ''}`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {errorMessage && (
              <div className="signin-error">
                <AlertCircle size={13} />
                {errorMessage}
              </div>
            )}

            {/* Already signed in elsewhere — manual re-check */}
            <div className="signin-alt-actions">
              <button
                type="button"
                className="signin-alt-btn"
                onClick={handleRetryCheck}
                disabled={status === 'signing_in' || status === 'checking'}
              >
                <CheckCircle2 size={14} />
                I've already signed in
              </button>
            </div>

            {/* API key hint */}
            <div className="signin-api-key-hint">
              <p>
                Alternatively, set the <code>XAI_API_KEY</code> environment variable
                before launching Grok Deck to use API key authentication.
              </p>
            </div>

          </div>
        </motion.div>

        {/* RIGHT: Showcase panel */}
        <div className="signin-right">
          <motion.div
            className="signin-showcase-outer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {/* Gradient border card */}
            <div className="signin-showcase-gradient" />
            <div className="signin-showcase-inner">
              <div className="signin-showcase-header">
                <h2>Your terminal,<br />but it thinks.</h2>
                <p>Grok agents handle complex multi-step tasks autonomously.</p>
              </div>

              <div className="signin-capability-grid">
                {capabilities.map((cap) => (
                  <div key={cap.title} className="signin-capability-card">
                    <div className="signin-capability-icon" style={{ background: cap.bg, color: cap.color }}>
                      {cap.icon}
                    </div>
                    <div className="signin-capability-title">{cap.title}</div>
                    <div className="signin-capability-desc">{cap.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
