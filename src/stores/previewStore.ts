import { create } from 'zustand';
import { PreviewTab, PreviewTabType } from '../types/preview';

interface PreviewStore {
  tabs: PreviewTab[];
  activeTabId: string | null;
  isOpen: boolean;

  openArtifact: (path: string, title: string, tabType: PreviewTabType, content?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  closePanel: () => void;
}

let tabCounter = 0;

export const usePreviewStore = create<PreviewStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  isOpen: false,

  openArtifact: (path, title, tabType, content) => {
    const existing = get().tabs.find((t) => t.path === path);
    if (existing) {
      set({ activeTabId: existing.id, isOpen: true });
      return;
    }
    const id = `preview-${Date.now()}-${tabCounter++}`;
    set((s) => ({
      tabs: [...s.tabs, { id, title, path, tabType, content }],
      activeTabId: id,
      isOpen: true,
    }));
  },

  closeTab: (id) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeTabId =
        s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeTabId;
      return { tabs, activeTabId, isOpen: tabs.length > 0 };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  closePanel: () => set({ isOpen: false, tabs: [], activeTabId: null }),
}));
