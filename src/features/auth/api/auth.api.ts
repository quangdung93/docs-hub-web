import { z } from 'zod';

import { apiSuccessSchema } from '@/core/api/errors';
import { type User, UserSchema } from '@/core/auth/tokens';
import { http } from '@/shared/api/http';

/**
 * Transport for the auth BFF routes. These hit same-origin Next route handlers
 * (`/api/auth/*`) — not the backend directly — because those handlers are what set
 * and clear the httpOnly cookies. The client only ever receives the safe `user`.
 */
export const authApi = {
  login: async (input: { email: string; password: string }): Promise<User> => {
    const { data } = await http.post('/auth/login', input);
    return apiSuccessSchema(z.object({ user: UserSchema })).parse(data).data.user;
  },

  logout: async (): Promise<void> => {
    await http.post('/auth/logout');
  },
};
