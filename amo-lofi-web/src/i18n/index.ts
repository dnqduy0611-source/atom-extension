import { en, type TranslationKey } from './en';
import { vi } from './vi';

// ── Supported Locales ──
export type Locale = 'en' | 'vi';
export const LOCALES: { id: Locale; label: string; flag: string }[] = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
];
export const DEFAULT_LOCALE: Locale = 'en';

// ── Translation map ──
const translations: Record<Locale, Record<string, string>> = { en, vi };

/**
 * Translate a key for a given locale.
 * Supports simple template interpolation: {0}, {1}, etc.
 *
 *   t('en', 'stats.bestDays', 7)  →  "Best: 7 days"
 */
export function t(locale: Locale, key: TranslationKey, ...args: (string | number)[]): string {
    const str = translations[locale]?.[key] ?? translations.en[key] ?? key;
    if (args.length === 0) return str;
    return str.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}

export type { TranslationKey };
