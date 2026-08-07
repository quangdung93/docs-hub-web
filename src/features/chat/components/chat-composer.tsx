'use client';

import { ArrowUp, Loader2, Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { IconButton } from '@/shared/ui';

/**
 * Question input. Enter sends, Shift+Enter inserts a newline (the mockup's
 * behaviour), and the textarea grows with its content up to a cap.
 */
export function ChatComposer({
  onSubmit,
  pending,
}: {
  onSubmit: (question: string) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const question = value.trim();
    if (!question || pending) return;
    onSubmit(question);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  return (
    <div className="border-border border-t p-3">
      <div className="border-border focus-within:ring-ring/40 flex items-end gap-2 rounded-xl border p-2 focus-within:ring-2">
        <IconButton icon={Paperclip} label={t('chat.attach')} />

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={pending}
          placeholder={t('chat.inputPlaceholder')}
          aria-label={t('chat.inputPlaceholder')}
          onChange={(event) => {
            setValue(event.target.value);
            const node = event.target;
            node.style.height = 'auto';
            node.style.height = `${Math.min(node.scrollHeight, 128)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          className="placeholder:text-muted-foreground max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none disabled:opacity-60"
        />

        <button
          type="button"
          onClick={send}
          disabled={pending || !value.trim()}
          aria-label={t('chat.send')}
          className="bg-brand hover:bg-brand-dark focus-visible:ring-ring/40 grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowUp className="size-4" aria-hidden />
          )}
        </button>
      </div>

      <p className="text-muted-foreground mt-1.5 px-1 text-center text-[11px]">
        {t('chat.disclaimer')}
      </p>
    </div>
  );
}
