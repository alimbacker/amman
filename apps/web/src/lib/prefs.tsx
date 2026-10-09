'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { t as translate, tr as trBilingual, type Bilingual, type Lang, type StringKey } from '@temple/shared';

export type TextSize = 'normal' | 'large' | 'xl';

interface Prefs {
  lang: Lang;
  langChosen: boolean;
  textSize: TextSize;
  setLang: (l: Lang) => void;
  setTextSize: (s: TextSize) => void;
  t: (k: StringKey, vars?: Record<string, string | number>) => string;
  tr: (b: Bilingual | undefined | null) => string;
}

const Ctx = createContext<Prefs | null>(null);

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private mode */ }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ta'); // Tamil is primary
  const [langChosen, setLangChosen] = useState(true); // avoid flashing the picker before we know
  const [textSize, setTextSizeState] = useState<TextSize>('normal');

  useEffect(() => {
    const l = read('lang');
    if (l === 'ta' || l === 'en') setLangState(l);
    else setLangChosen(false);
    const s = read('textSize');
    if (s === 'large' || s === 'xl' || s === 'normal') setTextSizeState(s);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.size = textSize;
  }, [lang, textSize]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setLangChosen(true);
    write('lang', l);
  }, []);
  const setTextSize = useCallback((s: TextSize) => {
    setTextSizeState(s);
    write('textSize', s);
  }, []);

  const value = useMemo<Prefs>(
    () => ({
      lang, langChosen, textSize, setLang, setTextSize,
      t: (k, vars) => translate(k, lang, vars),
      tr: (b) => trBilingual(b, lang),
    }),
    [lang, langChosen, textSize, setLang, setTextSize],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs outside PrefsProvider');
  return v;
}

/** Bookings opened on this device (also used when anonymous auth is unavailable). */
export const deviceBookings = {
  list(): string[] {
    try { return JSON.parse(read('myBookingIds') || '[]'); } catch { return []; }
  },
  add(id: string) {
    const ids = new Set(deviceBookings.list());
    ids.add(id);
    write('myBookingIds', JSON.stringify([...ids].slice(-50)));
  },
  clear() { write('myBookingIds', '[]'); },
};
