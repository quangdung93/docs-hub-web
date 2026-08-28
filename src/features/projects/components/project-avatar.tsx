import { Folder } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

/**
 * A project's logo, falling back to a folder icon.
 *
 * Every screen that names a project should show its logo, and before this three
 * of them hardcoded the icon — the logo only ever appeared on the picker grid.
 *
 * Not `shared/ui/avatar.tsx`: that one renders initials for a *person* and is
 * used for owners and members. A project without a logo wants the folder icon,
 * not the letters of its name.
 */
const SIZES = {
  sm: { box: 'size-5 rounded', icon: 'size-3.5' },
  md: { box: 'size-8 rounded-md', icon: 'size-4' },
  lg: { box: 'size-11 rounded-lg', icon: 'size-5.5' },
} as const;

export function ProjectAvatar({
  imageUrl,
  size = 'md',
  className,
}: {
  imageUrl: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, icon } = SIZES[size];

  return (
    <span
      className={cn(
        'bg-brand-subtle text-brand grid shrink-0 place-items-center overflow-hidden',
        box,
        className
      )}
    >
      {imageUrl ? (
        /* Presigned URL with a rotating signature: next/image would need it in
           remotePatterns and would cache a link that expires in 15 minutes. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <Folder className={icon} aria-hidden />
      )}
    </span>
  );
}
