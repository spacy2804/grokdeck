import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { Workspace, SessionInfo, Settings } from '../types/workspace';

export function useWorkspaces() {
  const store = useWorkspaceStore();

  const loadWorkspaces = useCallback(async () => {
    store.setLoadingWorkspaces(true);
    try {
      const ws = await invoke<Workspace[]>('get_workspaces');
      store.setWorkspaces(ws);
    } finally {
      store.setLoadingWorkspaces(false);
    }
  }, []);

  const loadSessions = useCallback(async (workspaceId?: string) => {
    store.setLoadingSessions(true);
    try {
      const sessions = await invoke<SessionInfo[]>('cmd_list_sessions', {
        workspaceId: workspaceId ?? null,
        limit: 50,
      });
      store.setSessions(sessions);
    } finally {
      store.setLoadingSessions(false);
    }
  }, []);

  const searchSessions = useCallback(async (query: string) => {
    const results = await invoke<SessionInfo[]>('cmd_search_sessions', { query, limit: 30 });
    store.setSessions(results);
  }, []);

  const createWorkspace = useCallback(async (name: string, color: string, projectDir?: string) => {
    const ws = await invoke<Workspace>('cmd_create_workspace', {
      name, color, projectDir: projectDir ?? null,
    });
    store.addWorkspace(ws);
    return ws;
  }, []);

  const updateWorkspace = useCallback(async (id: string, name: string, color: string, projectDir?: string) => {
    const ws = await invoke<Workspace>('cmd_update_workspace', {
      id, name, color, projectDir: projectDir ?? null,
    });
    store.updateWorkspace(ws);
    return ws;
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    await invoke('cmd_delete_workspace', { id });
    store.removeWorkspace(id);
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await invoke('cmd_delete_session', { sessionId });
    store.removeSession(sessionId);
  }, []);

  const loadSettings = useCallback(async () => {
    const s = await invoke<Settings>('get_settings');
    store.setSettings(s);
  }, []);

  const saveSettings = useCallback(async (settings: Settings) => {
    await invoke('cmd_save_settings', { settings });
    store.setSettings(settings);
  }, []);

  const pickDirectory = useCallback(async (): Promise<string | null> => {
    return await invoke<string | null>('pick_directory');
  }, []);

  return {
    workspaces: store.workspaces,
    sessions: store.sessions,
    activeWorkspaceId: store.activeWorkspaceId,
    settings: store.settings,
    isLoadingWorkspaces: store.isLoadingWorkspaces,
    isLoadingSessions: store.isLoadingSessions,
    setActiveWorkspace: store.setActiveWorkspace,
    loadWorkspaces,
    loadSessions,
    searchSessions,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    deleteSession,
    loadSettings,
    saveSettings,
    pickDirectory,
  };
}
