import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/**
 * Browser service-worker interception (optional). The primary dev flow uses the
 * standalone HTTP server instead, because the worker cannot intercept the app's
 * SERVER-side fetches (BFF proxy / RSC). Kept for pure client-only debugging.
 * To use it, generate the worker script once: `npx msw init public/ --save`.
 */
export const worker = setupWorker(...handlers);
