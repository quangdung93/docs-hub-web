'use client';

import { AlertCircle, Check, Loader2 } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';

import {
  INGESTION_STEPS,
  type IngestionStage,
  type IngestionStep,
  stepStateOf,
} from '../services/ingestion.service';

/**
 * The ingestion pipeline as RAGFlow presents it: parse → chunk → embed, each
 * step visible on its own so a stall or a failure points at a stage instead of
 * leaving the user with an indeterminate bar that never finishes.
 *
 * The stage machine lives in `ingestion.service`; this only draws it.
 */
const STEP_LABEL = {
  uploaded: 'ingestion.step.uploaded',
  parsing: 'ingestion.step.parsing',
  chunking: 'ingestion.step.chunking',
  embedding: 'ingestion.step.embedding',
  done: 'ingestion.step.done',
} as const satisfies Record<IngestionStep, string>;

export function IngestionSteps({
  stage,
  className,
}: {
  stage: IngestionStage;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div className={cn('space-y-1.5', className)}>
      <ol className="flex items-center gap-1" aria-label={t('ingestion.title')}>
        {INGESTION_STEPS.map((step, position) => {
          const state = stepStateOf(step, stage);

          return (
            <li key={step} className="flex flex-1 items-center gap-1">
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px]',
                  state === 'done' && 'border-status-indexed bg-status-indexed text-white',
                  state === 'active' && 'border-brand text-brand',
                  state === 'failed' && 'border-status-failed bg-status-failed text-white',
                  state === 'pending' && 'border-border text-muted-foreground'
                )}
              >
                {state === 'done' && <Check className="size-2.5" aria-hidden />}
                {state === 'active' && <Loader2 className="size-2.5 animate-spin" aria-hidden />}
                {state === 'failed' && <AlertCircle className="size-2.5" aria-hidden />}
                {state === 'pending' && position + 1}
              </span>

              {/* The connector is what makes it read as a pipeline; the last step
                  has nothing to connect to. */}
              {position < INGESTION_STEPS.length - 1 && (
                <span
                  className={cn(
                    'h-px flex-1',
                    state === 'done' ? 'bg-status-indexed' : 'bg-border'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          className={cn(
            stage.failed ? 'text-status-failed' : 'text-muted-foreground',
            !stage.failed && stage.isRunning && 'text-brand'
          )}
        >
          {t(STEP_LABEL[stage.failed ? (stage.failedAt ?? stage.step) : stage.step])}
        </span>
      </div>

      {stage.errorMessage && (
        <p className="text-status-failed/80 text-xs break-words">{stage.errorMessage}</p>
      )}
    </div>
  );
}
