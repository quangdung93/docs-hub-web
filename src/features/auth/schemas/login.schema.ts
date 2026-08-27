import { z } from 'zod';

/**
 * Login form + `/api/auth/login` request contract. The field is `email` because
 * that is what the auth backend authenticates on; the mockup labels it "Tên đăng
 * nhập" (username), which is a presentation choice — see `login.username`.
 * Validation messages are i18n keys, resolved through `t()` at render time.
 */
export const LoginInputSchema = z.object({
  email: z.string().trim().min(1, 'login.error.usernameRequired'),
  password: z.string().min(1, 'login.error.passwordRequired'),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
