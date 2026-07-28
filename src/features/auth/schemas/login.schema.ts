import { z } from 'zod';

/** Login form + `/api/auth/login` request contract. */
export const LoginInputSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
