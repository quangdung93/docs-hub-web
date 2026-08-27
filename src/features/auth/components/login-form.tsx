'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AppError } from '@/core/api/errors';
import { type MessageKey, useI18n } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';
import { Button, Checkbox, Field, FieldError } from '@/shared/ui';

import { useLogin } from '../hooks/use-auth';
import { type LoginInput, LoginInputSchema } from '../schemas/login.schema';

/** Shared shell for the icon-prefixed credential inputs. */
const inputShell =
  'border-input focus-within:ring-ring/40 flex h-9 items-center rounded-md border px-3 focus-within:ring-2';

/**
 * Login form — React Hook Form + Zod (one resolver from the shared schema). The
 * component renders and delegates the network call to `useLogin`; no business
 * logic lives here.
 */
export function LoginForm() {
  const { t } = useI18n();
  const login = useLogin();
  const [revealPassword, setRevealPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const serverError =
    login.error instanceof AppError
      ? login.error.message
      : login.error
        ? t('login.error.failed')
        : null;

  return (
    <form
      onSubmit={handleSubmit((values) => login.mutate(values))}
      className="mt-6 space-y-4"
      noValidate
    >
      <Field label={t('login.username')} htmlFor="username">
        <div className={cn(inputShell, errors.email && 'border-destructive')}>
          <User className="text-muted-foreground mr-2 size-4 shrink-0" aria-hidden />
          <input
            id="username"
            autoComplete="username"
            aria-invalid={!!errors.email}
            className="w-full bg-transparent text-sm outline-none"
            {...register('email')}
          />
        </div>
        {errors.email && <FieldError>{t(errors.email.message as MessageKey)}</FieldError>}
      </Field>

      <Field label={t('login.password')} htmlFor="password">
        <div className={cn(inputShell, errors.password && 'border-destructive')}>
          <Lock className="text-muted-foreground mr-2 size-4 shrink-0" aria-hidden />
          <input
            id="password"
            type={revealPassword ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            className="w-full bg-transparent text-sm outline-none"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setRevealPassword((current) => !current)}
            aria-label={t(revealPassword ? 'login.hidePassword' : 'login.showPassword')}
            className="text-muted-foreground hover:text-foreground ml-2 cursor-pointer"
          >
            {revealPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {errors.password && <FieldError>{t(errors.password.message as MessageKey)}</FieldError>}
      </Field>

      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        <Checkbox defaultChecked />
        {t('login.rememberMe')}
      </label>

      {serverError && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {t('login.submit')}
      </Button>
    </form>
  );
}
