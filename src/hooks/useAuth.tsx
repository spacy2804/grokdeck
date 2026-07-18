import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AuthCheckResult {
  authenticated: boolean;
  method: string;
  detail: string | null;
}

interface AuthContextValue {
  /** null = still checking, true = authenticated, false = not authenticated */
  authenticated: boolean | null;
  /** Re-check auth status from backend */
  checkAuth: () => Promise<void>;
  /** Mark as authenticated (after sign-in) */
  signIn: () => void;
  /** Sign out and redirect to /signin */
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const result = await invoke<AuthCheckResult>('check_auth_status');
      setAuthenticated(result.authenticated);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  const signIn = useCallback(() => {
    setAuthenticated(true);
  }, []);

  const signOut = useCallback(() => {
    setAuthenticated(false);
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ authenticated, checkAuth, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
