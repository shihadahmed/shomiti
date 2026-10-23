'use client';

import { useEffect, useState } from 'react';
import { getLang, dictionaries, setLang } from './i18n';

/**
 * Language hook that keeps SSR and client hydration consistent.
 * Starts with Bengali (the SSR default) then syncs to the stored locale.
 */
export function useLang() {
  const [lang, setLangState] = useState('bn');

  useEffect(() => {
    setLangState(getLang());
    const onChange = (event) => {
      setLangState(event?.detail?.lang || getLang());
    };
    window.addEventListener('languagechange', onChange);
    return () => window.removeEventListener('languagechange', onChange);
  }, []);

  const dict = dictionaries[lang] || dictionaries.bn;

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

  return { lang, tr, setLang: changeLang };
}

export default useLang;
