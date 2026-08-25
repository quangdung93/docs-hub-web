import { type RevisionDto } from '../api/document.dto';

/**
 * Ingestion pipeline, the way RAGFlow presents it: a file does not go from
 * "uploaded" straight to "searchable" — it is parsed, split into chunks, and
 * embedded, and each step can fail on its own.
 *
 * The backend exposes this as two independent fields rather than one progress
 * value: `status` tracks its own pipeline (the file landing in storage and being
 * parsed) and `ragflow_sync_status` mirrors RAGFlow's (chunking and embedding).
 * This module is the single place that turns that pair into the ordered steps
 * the UI draws, so the stage logic is testable without React.
 */
export const INGESTION_STEPS = ['uploaded', 'parsing', 'chunking', 'embedding', 'done'] as const;

export type IngestionStep = (typeof INGESTION_STEPS)[number];

export type StepState = 'pending' | 'active' | 'done' | 'failed';

export type IngestionStage = {
  /** Furthest step reached; the one rendered as active when not failed. */
  step: IngestionStep;
  failed: boolean;
  /** Which step failed, so the UI can mark it rather than the whole row. */
  failedAt?: IngestionStep;
  /** Worker message, already picked from whichever field carries it. */
  errorMessage?: string;
  /** True while the pipeline is still moving — drives polling. */
  isRunning: boolean;
};

/**
 * Backend `status` values seen so far: `queued`, `ready`, `indexed`,
 * `completed`, `failed`, `error`. RAGFlow mirror: null/empty, `pending`,
 * `syncing`, `synced`, `completed`, `failed`.
 *
 * Anything unrecognised is treated as in-progress rather than crashing the row —
 * `status` is a bare string on the wire, so new values can appear at any deploy.
 */
const FAILED = new Set(['failed', 'error']);
const NOT_STARTED = new Set(['queued', 'pending']);
const SYNC_DONE = new Set(['synced', 'completed']);
const PARSE_DONE = new Set(['indexed', 'completed', 'ready']);

function normalise(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Pick the most specific error the backend offers. `ragflow_last_error` is
 * checked first because a RAGFlow failure is the later, more precise cause;
 * `error_detail` beats `error_code` because the code alone ("SYS_500") tells a
 * user nothing.
 */
export function ingestionError(revision: RevisionDto): string | undefined {
  const candidates = [revision.ragflow_last_error, revision.error_detail, revision.error_code];
  return candidates.find((value) => normalise(value).length > 0) ?? undefined;
}

export function toIngestionStage(revision: RevisionDto | undefined): IngestionStage {
  if (!revision) return { step: 'uploaded', failed: false, isRunning: true };

  const status = normalise(revision.status);
  const sync = normalise(revision.ragflow_sync_status);
  const errorMessage = ingestionError(revision);

  // The backend's own pipeline failed — the file never reached RAGFlow, so the
  // break is at parsing, not at a step further down that never ran.
  if (FAILED.has(status)) {
    return { step: 'parsing', failed: true, failedAt: 'parsing', errorMessage, isRunning: false };
  }

  // Parsing succeeded and RAGFlow rejected it: chunking/embedding is where it
  // broke. `embedding` is the honest label — RAGFlow reports one status for
  // both, and it is the later of the two.
  if (FAILED.has(sync)) {
    return {
      step: 'embedding',
      failed: true,
      failedAt: 'embedding',
      errorMessage,
      isRunning: false,
    };
  }

  if (SYNC_DONE.has(sync)) {
    return { step: 'done', failed: false, isRunning: false };
  }

  // Nothing has touched the row yet: it is queued behind the worker.
  if (NOT_STARTED.has(status)) {
    return { step: 'uploaded', failed: false, isRunning: true };
  }

  if (PARSE_DONE.has(status)) {
    // Parsed, handed to RAGFlow. `syncing` means it is actively embedding;
    // anything else means it is waiting to be picked up — i.e. chunking.
    return { step: sync === 'syncing' ? 'embedding' : 'chunking', failed: false, isRunning: true };
  }

  // Unknown status: assume the backend is working on it.
  return { step: 'parsing', failed: false, isRunning: true };
}

/**
 * State of one step given the stage — what the stepper renders.
 * Steps before the current one are done; the current one is active (or failed);
 * later ones are pending.
 */
export function stepStateOf(step: IngestionStep, stage: IngestionStage): StepState {
  const current = INGESTION_STEPS.indexOf(stage.step);
  const position = INGESTION_STEPS.indexOf(step);

  if (stage.failed) {
    if (step === stage.failedAt) return 'failed';
    return position < current ? 'done' : 'pending';
  }

  if (stage.step === 'done') return 'done';
  if (position < current) return 'done';
  if (position === current) return 'active';
  return 'pending';
}

/** Rough progress for a compact bar, 0–1. `done` is 1, a failure freezes it. */
export function ingestionProgress(stage: IngestionStage): number {
  const position = INGESTION_STEPS.indexOf(stage.step);
  return position / (INGESTION_STEPS.length - 1);
}
