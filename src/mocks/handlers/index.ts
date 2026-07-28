import { healthHandlers } from './health';

/**
 * Single source of truth for mocked endpoints. Consumed by all three runtimes:
 * `server.ts` (Jest/node), `browser.ts` (dev worker), `standalone.ts` (HTTP server
 * on :4000 for Playwright + the app's own server-side fetches). Feature slices add
 * their handler arrays here (documents in Module 6, auth in Module 4).
 */
export const handlers = [...healthHandlers];
