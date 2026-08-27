import { http, HttpResponse } from 'msw';

import { db } from '../lib/db';
import { envelope, failure, paginate } from '../lib/envelope';

/**
 * Project endpoints mirroring docs-hub-api: the `/internal/api/v1` prefix, the
 * snake_case wire shape, paginated lists, and business failures returned as
 * HTTP 200 with `success:false`.
 */
const BASE = '*/internal/api/v1/projects';

export const projectHandlers = [
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
    const start = (page - 1) * limit;
    const slice = db.projects.slice(start, start + limit);

    return HttpResponse.json(envelope(slice, paginate(db.projects.length, page, limit)));
  }),

  http.post(BASE, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
    };

    const project = {
      id: `p-${Date.now()}`,
      owner_id: 'u-viettq45',
      name: body.name ?? 'Untitled project',
      description: body.description ?? '',
      status: 'active',
      settings: {
        model: 'qwen2.5',
        top_k: 5,
        chunk_size: 800,
        allowed_formats: ['PDF', 'DOCX', 'TXT', 'MD'],
      },
      created_at: new Date().toISOString(),
    };

    db.projects.push(project);
    db.documents[project.id] = [];
    return HttpResponse.json(envelope(project), { status: 201 });
  }),

  http.patch(`${BASE}/:projectId`, async ({ params, request }) => {
    const project = db.projects.find((item) => item.id === params.projectId);
    if (!project) {
      return HttpResponse.json(failure('PRJ_404', 'Project not found'), { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.name === 'string') project.name = body.name;
    if (typeof body.description === 'string') project.description = body.description;

    return HttpResponse.json(envelope(project));
  }),

  http.delete(`${BASE}/:projectId`, async ({ params, request }) => {
    const index = db.projects.findIndex((item) => item.id === params.projectId);
    if (index < 0) {
      return HttpResponse.json(failure('PRJ_404', 'Project not found'), { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { confirm_name?: string };
    // Business failure: HTTP 200 with success:false, exactly like the backend.
    if (body.confirm_name !== db.projects[index]?.name) {
      return HttpResponse.json(
        failure('CONFIRM_NAME_MISMATCH', 'Tên xác nhận không khớp tên dự án', {
          retryable: true,
        })
      );
    }

    db.projects.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/:projectId/members`, () =>
    // The real endpoint is not paginated.
    HttpResponse.json(envelope(db.members))
  ),

  http.post(`${BASE}/:projectId/members`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      user_id?: string;
      role?: 'editor' | 'viewer';
    };

    if (db.members.some((member) => member.user_id === body.user_id)) {
      return HttpResponse.json(
        failure('ALREADY_MEMBER', 'User đã là thành viên hoặc đang có lời mời')
      );
    }

    const member = {
      id: `m-${Date.now()}`,
      project_id: String(body.user_id ?? ''),
      user_id: body.user_id ?? '',
      role: body.role ?? ('viewer' as const),
      status: 'pending' as const,
      invited_at: new Date().toISOString(),
      joined_at: null,
    };
    db.members.push(member);
    return HttpResponse.json(envelope(member), { status: 201 });
  }),

  http.patch(`${BASE}/:projectId/members/:userId`, async ({ params, request }) => {
    const member = db.members.find((item) => item.user_id === params.userId);
    if (!member) {
      return HttpResponse.json(failure('MBR_404', 'Member not found'), { status: 404 });
    }
    if (member.role === 'owner') {
      return HttpResponse.json(
        failure('CANNOT_MODIFY_OWNER', 'Không thể đổi vai trò của chủ dự án')
      );
    }

    const body = (await request.json().catch(() => ({}))) as { role?: 'editor' | 'viewer' };
    if (body.role) member.role = body.role;
    return HttpResponse.json(envelope(member));
  }),

  http.delete(`${BASE}/:projectId/members/:userId`, ({ params }) => {
    const index = db.members.findIndex((item) => item.user_id === params.userId);
    if (index >= 0 && db.members[index]?.role === 'owner') {
      return HttpResponse.json(failure('CANNOT_MODIFY_OWNER', 'Không thể gỡ chủ dự án'));
    }
    if (index >= 0) db.members.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
