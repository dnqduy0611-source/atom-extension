import { useLofiStore } from '../store/useLofiStore';
import { t, LOCALES, type TranslationKey } from '../i18n';

/**
 * useTranslation — lightweight i18n hook for AmoLofi.
 *
 * Usage:
 *   const { t, locale, setLocale, cycleLocale } = useTranslation();
 *   <span>{t('sidebar.scenes')}</span>
 */
export function useTranslation() {
    const locale = useLofiStore((s) => s.locale);
    const setLocale = useLofiStore((s) => s.setLocale);

    /** Cycle to the next locale in the list */
    const cycleLocale = () => {
        const idx = LOCALES.findIndex((l) => l.id === locale);
        const next = LOCALES[(idx + 1) % LOCALES.length];
        setLocale(next.id);
    };

    /** Current locale info (label + flag) */
    const localeInfo = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

    return {
        t: (key: TranslationKey, ...args: (string | number)[]) => t(locale, key, ...args),
        locale,
        setLocale,
        cycleLocale,
        localeInfo,
    };
}
