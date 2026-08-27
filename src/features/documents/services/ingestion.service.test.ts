/**
 * Self-check for the ingestion stage machine. Run with
 * `npx tsx src/features/documents/services/ingestion.service.test.ts`.
 *
 * Every status pair here was observed on api.docshub.io.vn, plus the unknown
 * cases the wire's bare-string `status` makes possible.
 */
import assert from 'node:assert/strict';

import { type RevisionDto } from '../api/document.dto';

import {
  INGESTION_STEPS,
  ingestionError,
  ingestionProgress,
  stepStateOf,
  toIngestionStage,
} from './ingestion.service';

const base: RevisionDto = {
  id: 'r1',
  document_id: 'd1',
  project_id: 'p1',
  revision_no: 1,
  file_name: 'a.pdf',
  media_type: 'application/pdf',
  size_bytes: 10,
  sha256: 'x',
  status: 'queued',
  created_at: '2026-08-24T10:00:00Z',
  updated_at: '2026-08-24T10:00:00Z',
};

const rev = (patch: Partial<RevisionDto>): RevisionDto => ({ ...base, ...patch });

// ── Happy path, step by step ────────────────────────────────────────────────

// Freshly uploaded, worker has not picked it up (the state every real document
// on the backend is stuck in right now — RAGFlow is not connected).
assert.equal(toIngestionStage(rev({ status: 'queued' })).step, 'uploaded');
assert.equal(toIngestionStage(rev({ status: 'queued' })).isRunning, true);

// Parsed and handed over, RAGFlow has not started: chunking.
assert.equal(toIngestionStage(rev({ status: 'ready' })).step, 'chunking');
assert.equal(
  toIngestionStage(rev({ status: 'ready', ragflow_sync_status: 'pending' })).step,
  'chunking'
);

// RAGFlow actively working: embedding.
assert.equal(
  toIngestionStage(rev({ status: 'ready', ragflow_sync_status: 'syncing' })).step,
  'embedding'
);

// Fully searchable.
const done = toIngestionStage(rev({ status: 'indexed', ragflow_sync_status: 'synced' }));
assert.equal(done.step, 'done');
assert.equal(done.isRunning, false);
assert.equal(done.failed, false);
// `completed` is the other spelling of synced.
assert.equal(
  toIngestionStage(rev({ status: 'completed', ragflow_sync_status: 'completed' })).step,
  'done'
);

// `ready` on the RAGFlow side is also terminal — it appeared when RAGFlow was
// connected on 25/08/2026, alongside a `ragflow_synced_at` that stops changing.
// Reading it as in-progress would poll a settled row forever.
const ragflowReady = toIngestionStage(rev({ status: 'ready', ragflow_sync_status: 'ready' }));
assert.equal(ragflowReady.step, 'done');
assert.equal(ragflowReady.isRunning, false);

// ── Failures ────────────────────────────────────────────────────────────────

// Backend pipeline failed: the file never reached RAGFlow, so the break is at
// parsing — NOT at embedding, which never ran.
const parseFail = toIngestionStage(rev({ status: 'failed', error_detail: 'không đọc được PDF' }));
assert.equal(parseFail.failed, true);
assert.equal(parseFail.failedAt, 'parsing');
assert.equal(parseFail.errorMessage, 'không đọc được PDF');
assert.equal(parseFail.isRunning, false);

// Parsed fine, RAGFlow rejected it: the break is downstream.
const embedFail = toIngestionStage(
  rev({ status: 'ready', ragflow_sync_status: 'failed', ragflow_last_error: 'dataset missing' })
);
assert.equal(embedFail.failedAt, 'embedding');
assert.equal(embedFail.errorMessage, 'dataset missing');

// A failure must never be reported as still running — that would poll forever.
assert.equal(embedFail.isRunning, false);

// ── Error message precedence ────────────────────────────────────────────────

// The RAGFlow message wins: it is the later, more specific cause.
assert.equal(
  ingestionError(
    rev({ error_code: 'SYS_500', error_detail: 'chung', ragflow_last_error: 'cu the' })
  ),
  'cu the'
);
// Detail beats a bare code — "SYS_500" alone tells a user nothing.
assert.equal(ingestionError(rev({ error_code: 'SYS_500', error_detail: 'chi tiet' })), 'chi tiet');
assert.equal(ingestionError(rev({ error_code: 'SYS_500' })), 'SYS_500');
// Empty strings are not messages.
assert.equal(ingestionError(rev({ error_code: '', error_detail: '   ' })), undefined);
assert.equal(ingestionError(rev({})), undefined);

// ── Robustness ──────────────────────────────────────────────────────────────

// A status nobody has seen must not crash the row, and must not claim success.
const unknown = toIngestionStage(rev({ status: 'something-new' }));
assert.equal(unknown.failed, false);
assert.equal(unknown.isRunning, true);
assert.notEqual(unknown.step, 'done');

// Casing and stray whitespace come from a bare-string field.
assert.equal(
  toIngestionStage(rev({ status: '  INDEXED ', ragflow_sync_status: 'SYNCED' })).step,
  'done'
);

// No revision at all (list endpoint omits them) reads as freshly uploaded.
assert.equal(toIngestionStage(undefined).step, 'uploaded');

// ── Step states ─────────────────────────────────────────────────────────────

const chunking = toIngestionStage(rev({ status: 'ready' }));
assert.equal(stepStateOf('uploaded', chunking), 'done');
assert.equal(stepStateOf('parsing', chunking), 'done');
assert.equal(stepStateOf('chunking', chunking), 'active');
assert.equal(stepStateOf('embedding', chunking), 'pending');
assert.equal(stepStateOf('done', chunking), 'pending');

// Every step reads `done` once finished.
const finished = toIngestionStage(rev({ status: 'indexed', ragflow_sync_status: 'synced' }));
for (const step of INGESTION_STEPS) assert.equal(stepStateOf(step, finished), 'done');

// On failure only the failing step is marked; earlier ones stay done.
assert.equal(stepStateOf('embedding', embedFail), 'failed');
assert.equal(stepStateOf('uploaded', embedFail), 'done');
assert.equal(stepStateOf('done', embedFail), 'pending');

// ── Progress ────────────────────────────────────────────────────────────────

assert.equal(ingestionProgress(toIngestionStage(rev({ status: 'queued' }))), 0);
assert.equal(ingestionProgress(finished), 1);
assert.ok(ingestionProgress(chunking) > 0 && ingestionProgress(chunking) < 1);

console.log('ingestion.service: all assertions passed');
