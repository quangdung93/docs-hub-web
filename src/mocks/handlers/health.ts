import { http, HttpResponse } from 'msw';

import { HealthSchema } from '../../shared/api/health.schema';
import { envelope } from '../lib/envelope';

/**
 * Health endpoint. Matches any host so the same handler serves both paths:
 *  - client → `/api/health` → BFF proxy → `${API_URL}/health`
 *  - RSC    → `serverFetch('/health')` → `${API_URL}/health`
 * The response is validated against HealthSchema, so a contract change fails here.
 */
export const healthHandlers = [
  http.get('*/health', () => {
    const data = HealthSchema.parse({
      status: 'ok',
      service: 'docs-hub-api',
      version: '0.1.0',
      uptimeSeconds: Math.floor(process.uptime?.() ?? 0),
      timestamp: new Date().toISOString(),
    });
    return HttpResponse.json(envelope(data));
  }),
];
