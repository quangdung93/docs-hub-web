'use client';

import { MoreHorizontal, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { type MessageKey, useI18n } from '@/core/i18n';
import { formatDate } from '@/shared/lib/format';
import {
  Avatar,
  Badge,
  type BadgeProps,
  Button,
  DataTable,
  IconButton,
  SearchInput,
  Skeleton,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/shared/ui';

import { useProjectMembers } from '../hooks/use-projects';
import type { MemberRole } from '../schemas/project.schema';

/** Role → badge variant, label and the permission summary shown beside it. */
const ROLE_PRESENTATION: Record<
  MemberRole,
  { variant: NonNullable<BadgeProps['variant']>; labelKey: MessageKey; permissionKey: MessageKey }
> = {
  owner: {
    variant: 'brand',
    labelKey: 'members.role.owner',
    permissionKey: 'members.permission.full',
  },
  editor: {
    variant: 'neutral',
    labelKey: 'members.role.editor',
    permissionKey: 'members.permission.uploadAndAsk',
  },
  viewer: {
    variant: 'neutral',
    labelKey: 'members.role.viewer',
    permissionKey: 'members.permission.askOnly',
  },
  pending: {
    variant: 'queued',
    labelKey: 'members.role.pending',
    permissionKey: 'common.emptyValue',
  },
};

const COLUMN_COUNT = 5;

export function MemberTable({ projectId }: { projectId: string }) {
  const { t, locale } = useI18n();
  const { data: members, isPending } = useProjectMembers(projectId);
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const visible = (members ?? []).filter(
    (member) =>
      !query ||
      member.name.toLowerCase().includes(query) ||
      member.jobTitle.toLowerCase().includes(query)
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          className="w-72 max-w-full"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('members.searchPlaceholder')}
          aria-label={t('members.searchPlaceholder')}
        />
        <Button>
          <UserPlus aria-hidden />
          {t('members.invite')}
        </Button>
      </div>

      <DataTable className="mt-4">
        <TableHead>
          <tr>
            <TableHeaderCell>{t('members.column.member')}</TableHeaderCell>
            <TableHeaderCell>{t('members.column.role')}</TableHeaderCell>
            <TableHeaderCell>{t('members.column.permissions')}</TableHeaderCell>
            <TableHeaderCell>{t('members.column.joinedAt')}</TableHeaderCell>
            <TableHeaderCell />
          </tr>
        </TableHead>

        <tbody>
          {isPending &&
            Array.from({ length: 3 }, (_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!isPending && visible.length === 0 && (
            <TableEmptyRow colSpan={COLUMN_COUNT}>{t('members.empty')}</TableEmptyRow>
          )}

          {!isPending &&
            visible.map((member) => {
              const presentation = ROLE_PRESENTATION[member.role];
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} />
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-muted-foreground text-xs">{member.jobTitle}</div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={presentation.variant}>{t(presentation.labelKey)}</Badge>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {t(presentation.permissionKey)}
                  </TableCell>

                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {member.joinedAt ? formatDate(member.joinedAt, locale) : t('members.invited')}
                  </TableCell>

                  <TableCell className="text-right">
                    <IconButton
                      icon={MoreHorizontal}
                      size="sm"
                      label={t('documents.action.more')}
                      className="ml-auto"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
        </tbody>
      </DataTable>
    </>
  );
}
