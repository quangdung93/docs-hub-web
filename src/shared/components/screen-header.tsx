'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { CardHeader, CardTitle, IconButton } from '@/shared/ui';

import { useI18n } from '@/core/i18n';

/**
 * Bordered screen title strip: optional back button, title, an optional subtitle
 * line, and a right-aligned action slot. Used by the create-project, upload,
 * project-settings and chat screens — the mockup repeats this markup four times.
 */
export function ScreenHeader({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Where the back arrow goes. Omit to hide the arrow. */
  backHref?: string;
  action?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <CardHeader>
      {backHref && (
        <IconButton
          icon={ArrowLeft}
          label={t('common.back')}
          onClick={() => router.push(backHref)}
        />
      )}

      <div className="leading-tight">
        <CardTitle>{title}</CardTitle>
        {subtitle && (
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            {subtitle}
          </div>
        )}
      </div>

      {action && <div className="ml-auto">{action}</div>}
    </CardHeader>
  );
}
