'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AppError } from '@/core/api/errors';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import { useLogin } from '../hooks/use-auth';
import { type LoginInput, LoginInputSchema } from '../schemas/login.schema';

/**
 * Login form — React Hook Form + Zod (single resolver from the shared schema). All
 * validation logic is declarative; the component only renders and delegates the
 * network call to `useLogin`. No business logic lives here.
 */
export function LoginForm() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => login.mutate(values));

  const serverError =
    login.error instanceof AppError
      ? login.error.message
      : login.error
        ? 'Login failed. Please try again.'
        : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>

      {serverError && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={login.isPending || !isValid}>
        {login.isPending && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
