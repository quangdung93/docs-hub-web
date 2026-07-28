'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, Loader2 } from 'lucide-react';

import { healthQueryOptions } from '@/shared/api';
import { cn } from '@/shared/lib/utils';

/**
 * Client-path health check: useQuery → Axios → `/api/health` → BFF proxy → mock.
 * Demonstrates the full client transport spine (Module 3).
 */
export function HealthBadge() {
  const { data, isPending, isError } = useQuery(healthQueryOptions);

  const state = isPending ? 'loading' : isError ? 'error' : 'ok';
  const Icon = state === 'loading' ? Loader2 : state === 'error' ? CircleX : CircleCheck;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
        state === 'ok' && 'border-border bg-muted text-foreground',
        state === 'error' && 'border-destructive text-destructive',
        state === 'loading' && 'border-border text-muted-foreground'
      )}
    >
      <Icon className={cn('size-4', state === 'loading' && 'animate-spin')} />
      {state === 'loading' && 'Checking API…'}
      {state === 'error' && 'API unreachable'}
      {state === 'ok' && data && `API ${data.status} · v${data.version}`}
    </span>
  );
}
