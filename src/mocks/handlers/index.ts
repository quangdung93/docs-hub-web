import { authHandlers } from './auth';
import { chatHandlers } from './chat';
import { documentHandlers } from './documents';
import { healthHandlers } from './health';
import { projectHandlers } from './projects';

/**
 * Single source of truth for mocked endpoints. Consumed by all three runtimes:
 * `server.ts` (Jest/node), `browser.ts` (dev worker), `standalone.ts` (HTTP server
 * on :4000 for Playwright + the app's own server-side fetches).
 *
 * ORDER MATTERS: MSW matches the first handler that fits, and the bare
 * `:projectId` pattern would otherwise swallow its own nested resources
 * (documents, chat). Nested handlers are registered first.
 */
export const handlers = [
  ...healthHandlers,
  ...authHandlers,
  ...documentHandlers,
  ...chatHandlers,
  ...projectHandlers,
];
