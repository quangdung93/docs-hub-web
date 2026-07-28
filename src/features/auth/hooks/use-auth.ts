'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { authApi } from '../api/auth.api';

/**
 * Login mutation. On success we `router.refresh()` so server components re-read the
 * now-present session cookie, then navigate to the app.
 */
export function useLogin() {
  const router = useRouter();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: () => {
      router.replace('/account');
      router.refresh();
    },
  });
}

/** Logout mutation. Clears the client cache and returns to the login page. */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    },
  });
}
