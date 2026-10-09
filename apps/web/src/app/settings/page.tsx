'use client';
import { useState } from 'react';
import { usePrefs, deviceBookings, type TextSize } from '@/lib/prefs';
import { forgetDevice } from '@/lib/firebase';
import { PageTitle } from '@/components/shell';
import { IconCheck } from '@/components/icons';

export default function SettingsPage() {
  const { t, lang, setLang, textSize, setTextSize } = usePrefs();
  const [cleared, setCleared] = useState(false);
  const opt = (active: boolean) =>
    `btn w-full border-2 ${active ? 'border-crimson bg-saffron-pale text-crimson' : 'border-gold/30 bg-white text-ink'}`;
  return (
    <>
      <PageTitle title={t('settings')} />
      <div className="mx-auto max-w-xl space-y-6 px-4">
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-maroon">{t('language')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <button className={opt(lang === 'ta')} onClick={() => setLang('ta')}>{lang === 'ta' && <IconCheck />}தமிழ்</button>
            <button className={opt(lang === 'en')} onClick={() => setLang('en')}>{lang === 'en' && <IconCheck />}English</button>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-maroon">{t('textSize')}</h2>
          <div className="grid grid-cols-3 gap-3">
            {([['normal', 'normal', 'text-base'], ['large', 'large', 'text-lg'], ['xl', 'extraLarge', 'text-xl']] as [TextSize, 'normal' | 'large' | 'extraLarge', string][]).map(([v, k, cls]) => (
              <button key={v} className={`${opt(textSize === v)} ${cls} px-2`} onClick={() => setTextSize(v)}>{t(k)}</button>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <button className="btn-outline w-full" onClick={async () => { deviceBookings.clear(); await forgetDevice(); setCleared(true); }}>
            {cleared && <IconCheck />} {t('clearDevice')}
          </button>
        </section>
      </div>
    </>
  );
}
