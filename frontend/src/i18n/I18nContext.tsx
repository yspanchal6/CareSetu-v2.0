import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LanguageConfig,
  isSupportedLanguage,
  normalizeLanguageCode,
  getBrowserLanguage
} from './config';

import enLocale from './locales/en.json';
import hiLocale from './locales/hi.json';
import guLocale from './locales/gu.json';
import mrLocale from './locales/mr.json';
import bnLocale from './locales/bn.json';
import taLocale from './locales/ta.json';
import teLocale from './locales/te.json';
import knLocale from './locales/kn.json';
import mlLocale from './locales/ml.json';
import paLocale from './locales/pa.json';
import orLocale from './locales/or.json';
import asLocale from './locales/as.json';

const localesMap: Record<string, any> = {
  en: enLocale,
  hi: hiLocale,
  gu: guLocale,
  mr: mrLocale,
  bn: bnLocale,
  ta: taLocale,
  te: teLocale,
  kn: knLocale,
  ml: mlLocale,
  pa: paLocale,
  or: orLocale,
  as: asLocale,
};

export interface I18nContextValue {
  currentLanguage: string;
  languageConfig: LanguageConfig;
  supportedLanguages: LanguageConfig[];
  setLanguage: (code: string) => void;
  t: (key: string, params?: Record<string, any>) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function interpolate(template: string, params?: Record<string, any>): string {
  if (!template || typeof template !== 'string' || !params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (match, p1, p2) => {
    const key = p1 || p2;
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

export const I18nProvider: React.FC<{ children: ReactNode; userLanguagePreference?: string | null }> = ({
  children,
  userLanguagePreference
}) => {
  // Resolution Order:
  // 1. Authenticated user preference (if valid)
  // 2. Saved localStorage preference (if valid)
  // 3. Browser navigator language (if valid)
  // 4. Default ('en')
  const [currentLanguage, setCurrentLanguageState] = useState<string>(() => {
    if (isSupportedLanguage(userLanguagePreference)) {
      return normalizeLanguageCode(userLanguagePreference);
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isSupportedLanguage(saved)) {
        return normalizeLanguageCode(saved);
      }
    }
    return getBrowserLanguage();
  });

  // Sync if user preference loads asynchronously after auth login
  useEffect(() => {
    if (isSupportedLanguage(userLanguagePreference)) {
      const norm = normalizeLanguageCode(userLanguagePreference);
      setCurrentLanguageState(norm);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, norm);
      }
    }
  }, [userLanguagePreference]);

  const setLanguage = useCallback((code: string) => {
    const validCode = normalizeLanguageCode(code);
    setCurrentLanguageState(validCode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, validCode);
      document.documentElement.lang = validCode;
      const config = SUPPORTED_LANGUAGES.find(l => l.code === validCode);
      if (config) {
        document.documentElement.dir = config.direction;
      }
    }
  }, []);

  // Update HTML lang and dir attributes on mount / change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = currentLanguage;
      const config = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage);
      if (config) {
        document.documentElement.dir = config.direction;
      }
    }
  }, [currentLanguage]);

  const currentLanguageConfig =
    SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  const t = useCallback(
    (key: string, params?: Record<string, any>): string => {
      const activeDict = localesMap[currentLanguage] || localesMap[DEFAULT_LANGUAGE];
      const fallbackDict = localesMap[DEFAULT_LANGUAGE];

      let rawString: any = undefined;

      // Handle Pluralization if params.count is defined
      if (params && typeof params.count === 'number') {
        const countSuffix = params.count === 1 ? '_one' : '_other';
        rawString = getNestedValue(activeDict, `${key}${countSuffix}`);
        if (!rawString) {
          rawString = getNestedValue(fallbackDict, `${key}${countSuffix}`);
        }
      }

      if (!rawString || typeof rawString !== 'string') {
        rawString = getNestedValue(activeDict, key);
      }

      // Fall back to English dictionary if missing in target locale
      if (!rawString || typeof rawString !== 'string') {
        rawString = getNestedValue(fallbackDict, key);
      }

      // Fall back to key name if completely missing
      if (!rawString || typeof rawString !== 'string') {
        return key;
      }

      return interpolate(rawString, params);
    },
    [currentLanguage]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return String(date);
        const localeTag = currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'gu' ? 'gu-IN' : 'en-IN';
        return new Intl.DateTimeFormat(localeTag, options || { dateStyle: 'medium', timeStyle: 'short' }).format(d);
      } catch {
        return String(date);
      }
    },
    [currentLanguage]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string => {
      try {
        const localeTag = currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'gu' ? 'gu-IN' : 'en-IN';
        return new Intl.NumberFormat(localeTag, options).format(value);
      } catch {
        return String(value);
      }
    },
    [currentLanguage]
  );

  const formatCurrency = useCallback(
    (amount: number, currency = 'INR'): string => {
      try {
        const localeTag = currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'gu' ? 'gu-IN' : 'en-IN';
        return new Intl.NumberFormat(localeTag, { style: 'currency', currency }).format(amount);
      } catch {
        return `₹${amount}`;
      }
    },
    [currentLanguage]
  );

  return (
    <I18nContext.Provider
      value={{
        currentLanguage,
        languageConfig: currentLanguageConfig,
        supportedLanguages: SUPPORTED_LANGUAGES,
        setLanguage,
        t,
        formatDate,
        formatNumber,
        formatCurrency
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
