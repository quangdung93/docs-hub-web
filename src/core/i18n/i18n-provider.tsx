'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from './config';
import { en } from './messages/en';
import { vi, type MessageKey } from './messages/vi';

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { vi, en };

/** `t('projects.documentCount', { count: 12 })` → replaces every `{count}`. */
export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

/**
 * Locale provider. The initial locale comes from the server (cookie) so the first
 * paint already matches — no flash of the wrong language. Switching writes the
 * cookie so the next server render agrees with the client.
 */
export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // 1 year, root path — a display preference, so no httpOnly/secure requirement.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = DICTIONARIES[locale];
    return {
      locale,
      setLocale,
      t: (key, values) => interpolate(dictionary[key] ?? key, values),
    };
  }, [locale, setLocale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

/** Access the active locale and `t`. Throws outside the provider (a wiring bug). */
export function useI18n(): I18nContextValue {
  const context = use(I18nContext);
  if (!context) throw new Error('useI18n must be used within <I18nProvider>');
  return context;
}
