'use client';

import { useEffect, useState } from 'react';
import { getLang, dictionaries, setLang } from './i18n';
import { formatDate, formatDateTime } from './i18n';

/**
 * Language hook that keeps SSR and client hydration consistent.
 * Server always renders with 'en' (default), so client must also render 'en' initially
 * to avoid hydration mismatch. After mount, we sync with user's saved preference.
 */
export function useLang() {
  // Always start with 'en' to match server-side rendering
  const [lang, setLangState] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // After mount, sync with user's saved preference from sessionStorage (auth) or localStorage
    let savedLang = 'en';
    if (typeof window !== 'undefined') {
      try {
        const authData = sessionStorage.getItem('shomiti-auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          if (parsed.state?.user?.language && ['bn', 'en'].includes(parsed.state.user.language)) {
            savedLang = parsed.state.user.language;
          }
        }
      } catch {}
      
      // Fallback to localStorage if no auth data
      if (savedLang === 'en') {
        const stored = localStorage.getItem('shomiti.lang');
        if (stored && ['bn', 'en'].includes(stored)) {
          savedLang = stored;
        }
      }
    }
    
    if (savedLang !== lang) {
      setLangState(savedLang);
      // Also update the global i18n state
      setLang(savedLang);
    }
    
    const onChange = (event) => {
      setLangState(event?.detail?.lang || getLang());
    };
    window.addEventListener('languagechange', onChange);
    return () => window.removeEventListener('languagechange', onChange);
  }, []);

  const dict = dictionaries[lang] || dictionaries.en;

  const tr = (key, params) => {
    const template = dict[key] || key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => {
      return params && params[name] !== undefined ? String(params[name]) : `{${name}}`;
    });
  };

  const changeLang = (next) => {
    setLang(next);
    setLangState(next);
  };

  return { lang, tr, setLang: changeLang, formatDate, formatDateTime, mounted };
}

export default useLang;