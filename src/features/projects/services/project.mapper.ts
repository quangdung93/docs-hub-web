import type { ProjectDto, ProjectMemberDto } from '../api/project.dto';
import type { Project, ProjectMember, ProjectSettings } from '../schemas/project.schema';

/**
 * Wire DTO → domain model.
 *
 * Two things the backend does not send yet, handled explicitly rather than
 * silently defaulted:
 *
 *  - **Counters** (`documentCount`, `memberCount`, `chunkCount`) are sent by the
 *    read endpoints but not the write ones, so they stay nullable: a create or
 *    update response renders "—" rather than a fabricated 0, which would read as
 *    "this project is empty".
 *  - **Owner name** is not on ProjectResponse either — only `owner_id`. Resolving
 *    it needs a separate user lookup, so it stays null until the backend joins it
 *    or we add that call.
 */
export function toProject(dto: ProjectDto): Project {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? '',
    // The backend types `status` as a bare string. Anything we don't recognise
    // is treated as active rather than crashing the list.
    status: dto.status === 'archived' ? 'archived' : 'active',
    imageUrl: dto.avatar_url ?? null,
    ownerId: dto.owner_id,
    ownerName: null,
    documentCount: dto.document_count ?? null,
    memberCount: dto.member_count ?? null,
    chunkCount: dto.chunk_count ?? null,
    createdAt: dto.created_at,
  };
}

/**
 * The member list returns identity as `user_id` only — no name, email or job
 * title. Callers that need those must resolve them from the user module; the
 * table falls back to a shortened id so the row is still identifiable.
 */
export function toProjectMember(dto: ProjectMemberDto): ProjectMember {
  return {
    id: dto.id,
    userId: dto.user_id,
    name: dto.user?.full_name ?? null,
    email: dto.user?.email ?? null,
    jobTitle: null,
    // A pending invite is a distinct row state in the UI, but the backend keeps
    // role and status separate — collapse them the way the table renders them.
    role: dto.status === 'pending' ? 'pending' : dto.role,
    joinedAt: dto.joined_at ?? null,
  };
}

/**
 * Project settings. The backend exposes four inference fields; the UI also shows
 * embedding model, chunk overlap and three security toggles that do not exist
 * server-side yet. Those are surfaced as null so the settings panel can mark
 * them unavailable instead of showing a made-up value the user might try to edit.
 */
export function toProjectSettings(dto: ProjectDto): ProjectSettings {
  const settings = dto.settings;
  return {
    completionModel: settings?.model ?? null,
    topK: settings?.top_k ?? null,
    chunkSize: settings?.chunk_size ?? null,
    allowedFormats: settings?.allowed_formats ?? null,
    embeddingModel: null,
    chunkOverlap: null,
    auditLog: null,
    membersOnly: null,
    allowExport: null,
  };
}
