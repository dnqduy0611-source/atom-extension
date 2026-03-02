/**
 * NeuralMemory Dashboard — i18n module
 * Lightweight client-side translation with EN/VI support.
 */

const NM_I18N = {
  _locale: 'en',
  _strings: {},
  _loaded: false,

  async init() {
    const saved = localStorage.getItem('nm-locale');
    const browser = navigator.language?.startsWith('vi') ? 'vi' : 'en';
    this._locale = saved || browser;
    await this.load(this._locale);
  },

  async load(locale) {
    try {
      const resp = await fetch(`/static/locales/${locale}.json`);
      if (resp.ok) {
        this._strings = await resp.json();
        this._locale = locale;
        this._loaded = true;
      }
    } catch {
      console.warn(`Failed to load locale: ${locale}`);
    }
  },

  t(key) {
    return this._strings[key] || key;
  },

  get locale() {
    return this._locale;
  },

  async setLocale(locale) {
    localStorage.setItem('nm-locale', locale);
    await this.load(locale);
    this._locale = locale;
  }
};
