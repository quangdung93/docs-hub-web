import { cn } from '@/shared/lib/utils';

/**
 * Initials avatar. The mockup hand-picks a colour per member; here the tint is
 * derived from the name so any member list stays visually stable without the
 * backend having to send a colour.
 */
const TINTS = [
  'bg-brand-ink',
  'bg-status-approved',
  'bg-status-queued',
  'bg-brand-dark',
  'bg-status-archived',
] as const;

const SIZES = {
  sm: 'size-5 text-[10px]',
  md: 'size-8 text-[11px]',
  lg: 'size-10 text-sm',
} as const;

export function initialsOf(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, '');
  return letters.slice(0, 2).toUpperCase() || '?';
}

function tintOf(name: string): string {
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TINTS[sum % TINTS.length] ?? TINTS[0];
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold text-white',
        SIZES[size],
        tintOf(name),
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
