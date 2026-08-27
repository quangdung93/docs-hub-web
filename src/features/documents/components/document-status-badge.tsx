'use client';

import { type MessageKey, useI18n } from '@/core/i18n';
import { Badge, type BadgeProps } from '@/shared/ui';

import type { DocumentStatus } from '../schemas/document.schema';

/** Status → badge variant + label. One table, so the mapping can't drift. */
const PRESENTATION: Record<
  DocumentStatus,
  { variant: NonNullable<BadgeProps['variant']>; labelKey: MessageKey }
> = {
  indexed: { variant: 'indexed', labelKey: 'docStatus.indexed' },
  processing: { variant: 'processing', labelKey: 'docStatus.processing' },
  queued: { variant: 'queued', labelKey: 'docStatus.queued' },
  failed: { variant: 'failed', labelKey: 'docStatus.failed' },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useI18n();
  const { variant, labelKey } = PRESENTATION[status];
  return <Badge variant={variant}>{t(labelKey)}</Badge>;
}
