import { http, HttpResponse } from 'msw';

import {
  ProjectListSchema,
  ProjectMemberListSchema,
  ProjectSchema,
  ProjectSettingsSchema,
} from '../../features/projects/schemas/project.schema';
import { envelope, failure } from '../lib/envelope';
import { db } from '../lib/db';

/**
 * Project endpoints backed by the in-memory `db`. Every response is parsed with
 * the same Zod schema the client uses, so a mock that drifts from the contract
 * fails here rather than silently feeding the UI bad shapes.
 */
export const projectHandlers = [
  http.get('*/projects', ({ request }) => {
    const search = new URL(request.url).searchParams.get('search')?.toLowerCase();
    const projects = search
      ? db.projects.filter((project) => project.name.toLowerCase().includes(search))
      : db.projects;

    return HttpResponse.json(envelope(ProjectListSchema.parse(projects)));
  }),

  http.post('*/projects', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
    };

    const project = ProjectSchema.parse({
      id: `p${db.projects.length + 1}-${Date.now()}`,
      name: body.name ?? 'Untitled project',
      description: body.description ?? '',
      status: 'active',
      imageUrl: null,
      documentCount: 0,
      memberCount: 1,
      chunkCount: 0,
      ownerName: 'VietTQ45',
      createdAt: new Date().toISOString(),
    });

    db.projects.push(project);
    db.documents[project.id] = [];
    return HttpResponse.json(envelope(project), { status: 201 });
  }),

  http.get('*/projects/:projectId', ({ params }) => {
    const project = db.projects.find((item) => item.id === params.projectId);
    if (!project) {
      return HttpResponse.json(failure('ERR_NOT_FOUND', 'Project not found'), { status: 404 });
    }
    return HttpResponse.json(envelope(ProjectSchema.parse(project)));
  }),

  http.patch('*/projects/:projectId', async ({ params, request }) => {
    const project = db.projects.find((item) => item.id === params.projectId);
    if (!project) {
      return HttpResponse.json(failure('ERR_NOT_FOUND', 'Project not found'), { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    Object.assign(project, {
      name: typeof body.name === 'string' ? body.name : project.name,
      description: typeof body.description === 'string' ? body.description : project.description,
      status: body.status === 'archived' || body.status === 'active' ? body.status : project.status,
    });

    return HttpResponse.json(envelope(ProjectSchema.parse(project)));
  }),

  http.delete('*/projects/:projectId', ({ params }) => {
    const index = db.projects.findIndex((item) => item.id === params.projectId);
    if (index >= 0) db.projects.splice(index, 1);
    return HttpResponse.json(envelope({ ok: true }));
  }),

  http.get('*/projects/:projectId/members', () =>
    HttpResponse.json(envelope(ProjectMemberListSchema.parse(db.members)))
  ),

  http.get('*/projects/:projectId/settings', () =>
    HttpResponse.json(envelope(ProjectSettingsSchema.parse(db.settings)))
  ),

  http.put('*/projects/:projectId/settings', async ({ request }) => {
    const body = await request.json().catch(() => null);
    const parsed = ProjectSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(failure('ERR_VALIDATION', 'Invalid settings payload'), {
        status: 400,
      });
    }
    Object.assign(db.settings, parsed.data);
    return HttpResponse.json(envelope(ProjectSettingsSchema.parse(db.settings)));
  }),
];
