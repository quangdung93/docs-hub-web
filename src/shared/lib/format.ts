import type { Locale } from '@/core/i18n';

/**
 * Locale-aware formatters built on `Intl` — no dayjs needed for these two cases,
 * and `Intl.RelativeTimeFormat` already knows every language's pluralisation.
 */
const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** "2 giờ trước" / "2 hours ago". Falls back to "now" under a minute. */
export function formatRelativeTime(isoDate: string, locale: Locale, now = Date.now()): string {
  const diff = new Date(isoDate).getTime() - now;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(0, 'minute');
}

/** Short absolute date, e.g. "02/07/2026" (vi) or "Jul 2, 2026" (en). */
export function formatDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(isoDate));
}
