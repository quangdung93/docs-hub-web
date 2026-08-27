/**
 * Locale contract. Deliberately a hand-rolled dictionary module rather than
 * next-intl: the app has two locales and no routing/pluralisation/date-format
 * requirements, so a Record lookup + a cookie is the whole feature.
 * If message count or ICU formatting ever outgrows this, swap the provider
 * internals — every call site already goes through `useI18n().t`.
 */
export const LOCALES = ['vi', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'vi';

/** Cookie the locale is persisted in (readable by JS — it is not a secret). */
export const LOCALE_COOKIE = 'docs_hub_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
