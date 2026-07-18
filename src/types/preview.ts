// Preview panel tab types
export type PreviewTabType = 'csv' | 'code' | 'image' | 'markdown' | 'diff' | 'json';

export interface PreviewTab {
  id: string;
  title: string;
  path: string;
  tabType: PreviewTabType;
  content?: string;   // loaded file content
}
