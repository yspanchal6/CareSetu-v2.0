/**
 * CARESETU V2.0 - STEP 6
 * Central Language Metadata & Internationalization Configuration
 * Supports 12 Canonical Indian Languages
 */

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr'
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr'
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    direction: 'ltr'
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    direction: 'ltr'
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    direction: 'ltr'
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    direction: 'ltr'
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    direction: 'ltr'
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    direction: 'ltr'
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    direction: 'ltr'
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    direction: 'ltr'
  },
  {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    direction: 'ltr'
  },
  {
    code: 'as',
    name: 'Assamese',
    nativeName: 'অসমীয়া',
    direction: 'ltr'
  }
];

export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_STORAGE_KEY = 'caresetu_language_preference';

/**
 * Validates whether a given language code is officially supported.
 */
export function isSupportedLanguage(code: string | null | undefined): code is string {
  if (!code) return false;
  return SUPPORTED_LANGUAGES.some(lang => lang.code.toLowerCase() === code.toLowerCase());
}

/**
 * Normalizes an untrusted language code to a valid supported code or fallback ('en').
 */
export function normalizeLanguageCode(code: string | null | undefined): string {
  if (!code) return DEFAULT_LANGUAGE;
  const cleanCode = code.toLowerCase().trim().split('-')[0];
  const found = SUPPORTED_LANGUAGES.find(lang => lang.code === cleanCode);
  return found ? found.code : DEFAULT_LANGUAGE;
}

/**
 * Resolves default language from browser navigator or fallback.
 */
export function getBrowserLanguage(): string {
  if (typeof window === 'undefined' || !window.navigator) return DEFAULT_LANGUAGE;
  const navLang = window.navigator.language || (window.navigator as any).userLanguage || '';
  return normalizeLanguageCode(navLang);
}
