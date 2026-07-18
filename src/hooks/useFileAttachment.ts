import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { AttachedFileRecord, getFileAttachmentType } from '../types/grok';

export type { AttachedFileRecord };

export function useFileAttachment() {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileRecord[]>([]);

  const openFilePicker = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'All Files', extensions: ['*'] }],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];

      const newFiles = await Promise.all(
        paths.map(async (path): Promise<AttachedFileRecord> => {
          const name = path.split('/').pop() ?? path;
          const type = getFileAttachmentType(name);
          let dataUri: string | undefined;

          // Pre-load data URI for images so we can show thumbnails immediately
          if (type === 'image') {
            try {
              dataUri = await invoke<string>('read_file_as_data_uri', { filePath: path });
            } catch {
              // thumbnail just won't show — not critical
            }
          }

          return { path, name, type, dataUri };
        })
      );

      setAttachedFiles((prev) => {
        const existingPaths = new Set(prev.map((f) => f.path));
        const unique = newFiles.filter((f) => !existingPaths.has(f.path));
        return [...prev, ...unique];
      });
    } catch (err) {
      console.error('File picker error:', err);
    }
  }, []);

  const removeFile = useCallback((path: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const clearFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  /**
   * Build the actual CLI prompt — used only for grok CLI, NOT for display.
   * The user sees their typed text + file pills separately.
   */
  const buildPromptWithFiles = useCallback(
    (text: string): string => {
      if (attachedFiles.length === 0) return text;
      const filePart = attachedFiles.map((f) => f.path).join('\n');
      return `${text}\n\nPlease use the following file(s):\n${filePart}`;
    },
    [attachedFiles],
  );

  return {
    attachedFiles,
    openFilePicker,
    removeFile,
    clearFiles,
    buildPromptWithFiles,
  };
}
