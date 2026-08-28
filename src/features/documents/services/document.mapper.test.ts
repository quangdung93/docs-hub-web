/**
 * Self-check for revision → change-history mapping. Run with
 * `npx tsx src/features/documents/services/document.mapper.test.ts`.
 *
 * The shapes here are copied from real `GET /documents/{id}` responses on
 * api.docshub.io.vn (28/08/2026), including the two the backend actually sends:
 * a revision with a `scope` and one with the field absent entirely.
 */
import assert from 'node:assert/strict';

import { type RevisionDto } from '../api/document.dto';

import { toDocument, toHistory } from './document.mapper';

const revision = (over: Partial<RevisionDto>): RevisionDto => ({
  id: 'r1',
  document_id: 'd1',
  project_id: 'p1',
  revision_no: 1,
  file_name: 'urd.docx',
  media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size_bytes: 1000,
  status: 'ready',
  ragflow_sync_status: 'ready',
  created_at: '2026-08-27T03:53:14Z',
  updated_at: '2026-08-27T03:53:33Z',
  ...over,
});

// ── Newest first, regardless of the order the wire happened to use ──────────
{
  const history = toHistory([
    revision({ id: 'r1', revision_no: 1 }),
    revision({ id: 'r3', revision_no: 3 }),
    revision({ id: 'r2', revision_no: 2 }),
  ]);
  assert.deepEqual(
    history.map((entry) => entry.revisionNo),
    [3, 2, 1],
    'history must be newest revision first'
  );
}

// ── Scope is what tells the UI which project version a file belongs to ──────
{
  const [scoped, unscoped] = toHistory([
    revision({ id: 'r2', revision_no: 2 }),
    revision({ id: 'r1', revision_no: 1, scope: { project_version_id: 'v-1' } }),
  ]);
  assert.equal(scoped!.projectVersionId, null, 'a revision with no scope maps to null');
  assert.equal(unscoped!.projectVersionId, 'v-1');
}

// ── An empty or absent revision list is a real response, not an error ───────
assert.deepEqual(toHistory(undefined), []);
assert.deepEqual(toHistory([]), []);
assert.deepEqual(toHistory(null), []);

// ── The document takes its version from the NEWEST revision, not the first ──
{
  const document = toDocument(
    {
      id: 'd1',
      project_id: 'p1',
      title: 'URD',
      created_at: '2026-08-27T03:53:14Z',
      updated_at: '2026-08-27T03:53:14Z',
      version: 1,
    },
    [
      revision({ id: 'r1', revision_no: 1, scope: { project_version_id: 'v-old' } }),
      revision({ id: 'r2', revision_no: 2, scope: { project_version_id: 'v-new' } }),
    ]
  );
  assert.equal(document.projectVersionId, 'v-new', "the row shows the newest revision's version");
  assert.equal(document.revisionNo, 2);
  assert.equal(document.history.length, 2);
}

// ── A list-only row (no revisions) must not claim a version it cannot know ──
{
  const document = toDocument({
    id: 'd1',
    project_id: 'p1',
    title: 'URD',
    created_at: '2026-08-27T03:53:14Z',
    updated_at: '2026-08-27T03:53:14Z',
    version: 1,
  });
  assert.equal(document.projectVersionId, null);
  assert.deepEqual(document.history, []);
}

console.log('document.mapper self-check passed');
