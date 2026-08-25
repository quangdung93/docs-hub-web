import { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

/**
 * In-memory log of every request the Axios client makes, so the API inspector
 * can show a replayable curl + the response without opening devtools.
 *
 * Deliberately a plain module-level array with a listener set rather than a
 * Zustand store: nothing outside the inspector reads it, and it must be safe to
 * write to from an interceptor that runs outside React's render cycle.
 *
 * ponytail: capped ring buffer, no persistence. Bump MAX or add
 * sessionStorage only if someone actually needs history across reloads.
 */
export type ApiLogEntry = {
  id: string;
  method: string;
  /** Path as called, relative to the BFF (`/api/...`). */
  url: string;
  /** Full same-origin URL, used to build the curl line. */
  absoluteUrl: string;
  requestBody?: string;
  /** `FormData` can't be replayed as a string — list the parts instead. */
  formParts?: { name: string; value: string }[];
  startedAt: number;
  durationMs?: number;
  status?: number;
  responseBody?: string;
  error?: string;
};

const MAX_ENTRIES = 50;

const entries: ApiLogEntry[] = [];
const listeners = new Set<() => void>();

/** Kept stable so `useSyncExternalStore` doesn't loop: only reassigned on write. */
let snapshot: readonly ApiLogEntry[] = [];

function emit() {
  snapshot = [...entries];
  listeners.forEach((listener) => listener());
}

export function subscribeApiLog(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiLog(): readonly ApiLogEntry[] {
  return snapshot;
}

export function clearApiLog() {
  entries.length = 0;
  emit();
}

let counter = 0;

/**
 * Only the request body is capped, and generously: a multipart upload would
 * otherwise put the whole file in memory. Responses are kept in full — a
 * truncated payload is exactly the thing you cannot debug from.
 */
const MAX_REQUEST_CHARS = 100_000;

function truncate(text: string): string {
  return text.length > MAX_REQUEST_CHARS
    ? `${text.slice(0, MAX_REQUEST_CHARS)}\n… (cắt bớt ${text.length - MAX_REQUEST_CHARS} ký tự)`
    : text;
}

function describeBody(data: unknown): Pick<ApiLogEntry, 'requestBody' | 'formParts'> {
  if (data == null) return {};

  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const formParts = [...data.entries()].map(([name, value]) => ({
      name,
      value:
        typeof value === 'string'
          ? value
          : `@${value.name} (${value.size} bytes, ${value.type || 'unknown'})`,
    }));
    return { formParts };
  }

  if (typeof data === 'string') return { requestBody: truncate(data) };

  try {
    return { requestBody: truncate(JSON.stringify(data, null, 2)) };
  } catch {
    return { requestBody: '[không serialise được]' };
  }
}

export function logRequestStart(config: InternalAxiosRequestConfig): string {
  const id = `req-${++counter}`;
  const url = `${config.baseURL ?? ''}${config.url ?? ''}`;

  entries.unshift({
    id,
    method: (config.method ?? 'get').toUpperCase(),
    url,
    absoluteUrl: typeof window === 'undefined' ? url : new URL(url, window.location.origin).href,
    startedAt: Date.now(),
    ...describeBody(config.data),
  });

  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  emit();
  return id;
}

function finish(id: string | undefined, patch: Partial<ApiLogEntry>) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  Object.assign(entry, patch, { durationMs: Date.now() - entry.startedAt });
  emit();
}

function stringifyResponse(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return '[không serialise được]';
  }
}

export function logResponse(id: string | undefined, response: AxiosResponse) {
  finish(id, { status: response.status, responseBody: stringifyResponse(response.data) });
}

export function logError(id: string | undefined, error: AxiosError) {
  finish(id, {
    status: error.response?.status,
    responseBody: error.response ? stringifyResponse(error.response.data) : undefined,
    error: error.message,
  });
}

/** Shell-quote for a single-quoted argument. */
function shellQuote(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

function bodyLines(entry: ApiLogEntry): string[] {
  if (entry.formParts) {
    return entry.formParts.map(
      (part) => `  -F '${shellQuote(part.name)}=${shellQuote(part.value)}'`
    );
  }
  if (entry.requestBody) {
    return [`  -H 'Content-Type: application/json'`, `  --data '${shellQuote(entry.requestBody)}'`];
  }
  return [];
}

/**
 * The call as it left the browser: same-origin, against the BFF. Replayable only
 * with the browser's cookie jar, because the token lives in an httpOnly cookie
 * that JS cannot read — which is the whole point of the BFF auth model.
 */
export function toCurl(entry: ApiLogEntry): string {
  return [
    `curl -X ${entry.method} '${entry.absoluteUrl}'`,
    ...bodyLines(entry),
    `  -b cookies.txt   # đăng nhập trước: curl -X POST '<origin>/api/auth/login' -c cookies.txt -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}'`,
  ].join(' \\\n');
}

/**
 * The same call aimed straight at docs-hub-api, for handing to the backend team.
 *
 * The BFF strips its own `/api` prefix and forwards the rest verbatim, so the
 * upstream path is recoverable from the browser URL. `$TOKEN` stays a
 * placeholder: the real one is in an httpOnly cookie this code cannot read, and
 * pasting a live token into a shareable snippet would leak it anyway.
 */
export function toUpstreamCurl(entry: ApiLogEntry, apiBase = 'https://api.docshub.io.vn'): string {
  const path = new URL(entry.absoluteUrl).pathname.replace(/^.*?\/api\//, '/');
  const search = new URL(entry.absoluteUrl).search;

  return [
    `curl -X ${entry.method} '${apiBase}${path}${search}'`,
    `  -H 'Authorization: Bearer $TOKEN'`,
    ...bodyLines(entry),
  ].join(' \\\n');
}
