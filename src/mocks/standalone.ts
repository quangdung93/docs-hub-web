import './load-env';

import { createMiddleware } from '@mswjs/http-middleware';
import express from 'express';

import { handlers } from './handlers';

/**
 * MSW as a real HTTP server. This is the runtime the app talks to in local dev
 * and in Playwright: point `API_URL` at it and EVERY layer — the BFF proxy, RSC
 * `serverFetch`, and client XHR — hits the same handlers, because it's real HTTP
 * (a browser service worker can't intercept the server's own fetch calls).
 *
 * Run with `npm run mock` (or `npm run dev:mock` to start it alongside Next).
 */
const PORT = Number(process.env.MOCK_PORT ?? 4000);

const app = express();
app.use(express.json());
app.use(createMiddleware(...handlers));

app.listen(PORT, () => {
  console.log(`[mock] MSW standalone API listening on http://localhost:${PORT}`);
});
