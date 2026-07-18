import { create } from 'zustand';
import { Workspace, SessionInfo, Settings, DEFAULT_SETTINGS } from '../types/workspace';

interface WorkspaceStore {
  workspaces: Workspace[];
  sessions: SessionInfo[];
  activeWorkspaceId: string | null;
  settings: Settings;
  isLoadingWorkspaces: boolean;
  isLoadingSessions: boolean;

  setWorkspaces: (ws: Workspace[]) => void;
  setSessions: (sessions: SessionInfo[]) => void;
  setActiveWorkspace: (id: string | null) => void;
  setSettings: (s: Settings) => void;
  addWorkspace: (ws: Workspace) => void;
  updateWorkspace: (ws: Workspace) => void;
  removeWorkspace: (id: string) => void;
  removeSession: (sessionId: string) => void;
  setLoadingWorkspaces: (v: boolean) => void;
  setLoadingSessions: (v: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  workspaces: [],
  sessions: [],
  activeWorkspaceId: null,
  settings: DEFAULT_SETTINGS,
  isLoadingWorkspaces: false,
  isLoadingSessions: false,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setSessions: (sessions) => set({ sessions }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setSettings: (settings) => set({ settings }),
  addWorkspace: (ws) => set((s) => ({ workspaces: [...s.workspaces, ws] })),
  updateWorkspace: (ws) =>
    set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === ws.id ? ws : w)) })),
  removeWorkspace: (id) =>
    set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) })),
  removeSession: (sessionId) =>
    set((s) => ({ sessions: s.sessions.filter((s) => s.sessionId !== sessionId) })),
  setLoadingWorkspaces: (v) => set({ isLoadingWorkspaces: v }),
  setLoadingSessions: (v) => set({ isLoadingSessions: v }),
}));
