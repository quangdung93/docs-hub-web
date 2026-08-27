import { z } from 'zod';

/**
 * Runtime environment contract — validated once at module load so a misconfigured
 * deploy fails fast and loudly instead of surfacing as a mysterious runtime error.
 *
 * Two schemas on purpose:
 *  - `serverSchema` may read secrets; it is only ever imported by server code.
 *  - `clientSchema` covers `NEXT_PUBLIC_*` values that get inlined into the bundle.
 *
 * Client vars MUST be referenced by their literal `process.env.NEXT_PUBLIC_*` key
 * (not dynamically) so Next can statically inline them. That is why the client
 * block below spells each key out rather than iterating `process.env`.
 */

const nodeEnv = z.enum(['development', 'test', 'production']);

const serverSchema = z.object({
  NODE_ENV: nodeEnv.default('development'),
  APP_ENV: z.enum(['local', 'development', 'staging', 'production']).default('local'),

  /**
   * Upstream backend base URL the BFF proxy forwards to (server-only egress).
   *
   * Host and port only. Every path in `core/api/endpoints.ts` already carries
   * its `/public/api/v1` or `/internal/api/v1` prefix, so a base URL that
   * repeats one produces `/public/api/v1/public/api/v1/...` and every request
   * 404s. That misconfiguration took down login on the first production deploy,
   * so the prefix is stripped here rather than left to be rediscovered.
   */
  API_URL: z
    .url()
    .default('http://localhost:4000')
    .transform((value) => value.replace(/\/(public|internal)\/api\/v\d+\/?$/, '')),

  /** Enable in-process MSW mocking of the upstream API. Defaults on outside prod. */
  ENABLE_MOCKS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  /** JWT verification config — consumed by core/auth in Module 4. Optional here. */
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
  AUTH_SECRET: z.string().min(16).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('Document Hub'),
  NEXT_PUBLIC_APP_ENV: z.enum(['local', 'development', 'staging', 'production']).default('local'),
});

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}

/** Validated server env. Import only from server components / route handlers. */
export const serverEnv = (() => {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment variables:\n${formatIssues(parsed.error)}`);
  }
  return parsed.data;
})();

/** Validated public env. Safe to import from client components. */
export const clientEnv = (() => {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public environment variables:\n${formatIssues(parsed.error)}`);
  }
  return parsed.data;
})();

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
