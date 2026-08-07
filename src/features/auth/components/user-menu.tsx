'use client';

import { LogOut, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';
import { Avatar, ConfirmDialog } from '@/shared/ui';

import { useLogout } from '../hooks/use-auth';

/**
 * Signed-in identity in the top bar: an avatar that opens a small menu (profile +
 * a destructive sign-out). Sign-out routes through the shared ConfirmDialog so the
 * confirmation matches every other destructive action in the app.
 */
export function UserMenu({ name }: { name: string }) {
  const { t } = useI18n();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu on any outside click or Escape — the native <details> would
  // give us this for free but can't hold the confirm dialog cleanly.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        className="focus-visible:ring-ring/40 rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        <Avatar name={name} size="md" />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-surface absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-lg border p-1 shadow-lg"
        >
          <div className="border-border flex items-center gap-2 border-b px-2 py-2">
            <Avatar name={name} size="sm" />
            <span className="truncate text-sm font-medium">{name}</span>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.alert(t('userMenu.comingSoon'));
            }}
            className="hover:bg-surface-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
          >
            <User className="size-4" aria-hidden />
            {t('userMenu.profile')}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className={cn(
              'text-status-failed hover:bg-status-failed/10 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm'
            )}
          >
            <LogOut className="size-4" aria-hidden />
            {t('userMenu.logout')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={t('userMenu.logoutConfirmTitle')}
        description={t('userMenu.logoutConfirmDescription')}
        confirmLabel={t('userMenu.logoutConfirm')}
        cancelLabel={t('userMenu.logoutStay')}
        pending={logout.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => logout.mutate()}
      />
    </div>
  );
}
