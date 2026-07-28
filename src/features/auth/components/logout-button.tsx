'use client';

import { LogOut } from 'lucide-react';

import { Button } from '@/shared/ui/button';

import { useLogout } from '../hooks/use-auth';

export function LogoutButton() {
  const logout = useLogout();
  return (
    <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
      <LogOut />
      Sign out
    </Button>
  );
}
