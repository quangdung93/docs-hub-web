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

/** Truncated so a 10 MB upload body never lands in memory or the DOM. */
const MAX_BODY_CHARS = 20_000;

function truncate(text: string): string {
  return text.length > MAX_BODY_CHARS
    ? `${text.slice(0, MAX_BODY_CHARS)}\n… (cắt bớt ${text.length - MAX_BODY_CHARS} ký tự)`
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
  if (typeof data === 'string') return truncate(data);
  try {
    return truncate(JSON.stringify(data, null, 2));
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

/**
 * Rebuild the call as a runnable curl.
 *
 * The token deliberately does NOT appear: it lives in an httpOnly cookie the
 * browser never exposes to JS. `--cookie` with the browser's jar is the closest
 * replayable equivalent; for a terminal-only run, log in with the auth route
 * first and reuse that cookie jar.
 */
export function toCurl(entry: ApiLogEntry): string {
  const lines = [`curl -X ${entry.method} '${entry.absoluteUrl}'`];

  if (entry.formParts) {
    entry.formParts.forEach((part) => {
      lines.push(`  -F '${part.name}=${part.value}'`);
    });
  } else if (entry.requestBody) {
    lines.push(`  -H 'Content-Type: application/json'`);
    lines.push(`  --data '${entry.requestBody.replace(/'/g, `'\\''`)}'`);
  }

  lines.push(`  -b cookies.txt   # đăng nhập trước: POST /api/auth/login -c cookies.txt`);
  return lines.join(' \\\n');
}
