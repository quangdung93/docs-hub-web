import { FileImage, FileSpreadsheet, FileText, FileType, type LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

/**
 * Tinted file-format square. One lookup table so the document table, the upload
 * queue and the citation panel agree on what a `.docx` looks like — the mockup
 * hardcoded a red PDF tile on every row, including the Word and Excel ones.
 */
const BY_EXTENSION: Record<string, { icon: LucideIcon; className: string }> = {
  pdf: { icon: FileText, className: 'bg-status-failed-bg text-status-failed' },
  doc: { icon: FileType, className: 'bg-status-processing-bg text-status-processing' },
  docx: { icon: FileType, className: 'bg-status-processing-bg text-status-processing' },
  xls: { icon: FileSpreadsheet, className: 'bg-status-indexed-bg text-status-indexed' },
  xlsx: { icon: FileSpreadsheet, className: 'bg-status-indexed-bg text-status-indexed' },
  md: { icon: FileText, className: 'bg-status-queued-bg text-status-queued' },
  txt: { icon: FileText, className: 'bg-muted text-muted-foreground' },
  png: { icon: FileImage, className: 'bg-status-failed-bg text-status-failed' },
  jpg: { icon: FileImage, className: 'bg-status-failed-bg text-status-failed' },
  jpeg: { icon: FileImage, className: 'bg-status-failed-bg text-status-failed' },
};

const FALLBACK = { icon: FileText, className: 'bg-muted text-muted-foreground' };

export function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function FileTypeIcon({ fileName, className }: { fileName: string; className?: string }) {
  const { icon: Icon, className: tint } = BY_EXTENSION[extensionOf(fileName)] ?? FALLBACK;
  return (
    <span
      aria-hidden
      className={cn('grid size-8 shrink-0 place-items-center rounded-md', tint, className)}
    >
      <Icon className="size-4" />
    </span>
  );
}
