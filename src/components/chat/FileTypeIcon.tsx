import { FileCode2, FileSpreadsheet, FileText, File, Image as ImageIcon } from 'lucide-react';
import { FileAttachmentType } from '../../types/grok';

/** Icon component matching each file attachment type */
export function FileTypeIcon({ type, size = 13 }: { type: FileAttachmentType; size?: number }) {
  switch (type) {
    case 'image':    return <ImageIcon size={size} />;
    case 'sheet':    return <FileSpreadsheet size={size} />;
    case 'document': return <FileText size={size} />;
    case 'pdf':      return <FileText size={size} />;
    case 'text':     return <FileCode2 size={size} />;
    default:         return <File size={size} />;
  }
}
