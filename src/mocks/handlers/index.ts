import { authHandlers } from './auth';
import { chatHandlers } from './chat';
import { documentHandlers } from './documents';
import { healthHandlers } from './health';
import { projectHandlers } from './projects';
import { urdHandlers } from './urd';

/**
 * Single source of truth for mocked endpoints. Consumed by all three runtimes:
 * `server.ts` (Jest/node), `browser.ts` (dev worker), `standalone.ts` (HTTP server
 * on :4000 for Playwright + the app's own server-side fetches).
 *
 * ORDER MATTERS: MSW matches the first handler that fits, and the bare
 * `:projectId` pattern would otherwise swallow its own nested resources
 * (documents, chat). Nested handlers are registered first.
 *
 * Cùng lý do đó, `urdHandlers` phải đứng trước `documentHandlers`:
 * `/documents/urd-summary` cũng khớp với mẫu `/documents/:documentId`, để sau
 * thì toàn bộ phần tóm tắt độ hoàn thiện rơi vào handler chi tiết tài liệu.
 */
export const handlers = [
  ...healthHandlers,
  ...authHandlers,
  ...urdHandlers,
  ...documentHandlers,
  ...chatHandlers,
  ...projectHandlers,
];
