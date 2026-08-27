'use client';

import { UploadCloud } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * Drag-and-drop file picker. Shared by the create-project wizard and the upload
 * screen — the mockup duplicates this markup, so it earns a component. Drag state
 * is local presentation only; validation lives in the upload feature's service.
 */
export function Dropzone({
  onFilesSelected,
  accept,
  title,
  browseLabel,
  orLabel,
  fromDeviceLabel,
  hint,
  className,
}: {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  title: string;
  browseLabel: string;
  orLabel: string;
  fromDeviceLabel: string;
  hint: string;
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emit = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length) onFilesSelected(files);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    emit(event.dataTransfer.files);
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'group border-input bg-surface-muted/60 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed p-6 text-center transition-colors',
        'hover:border-brand/60 hover:bg-brand-subtle/40 focus-within:ring-ring/40 focus-within:ring-2',
        dragging && 'border-brand bg-brand-subtle/60',
        className
      )}
    >
      <div>
        <span className="bg-surface text-brand ring-border group-hover:ring-brand/40 mx-auto grid size-14 place-items-center rounded-full ring-1 transition">
          <UploadCloud className="size-7" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {orLabel} <span className="text-brand font-medium">{browseLabel}</span> {fromDeviceLabel}
        </p>
        <p className="text-muted-foreground mt-4 text-xs">{hint}</p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            emit(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </label>
  );
}
