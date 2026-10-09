'use client';
import { whatsappLink } from '@temple/shared';
import { usePrefs } from '@/lib/prefs';
import { useTemple } from '@/lib/data';
import { PageTitle } from '@/components/shell';
import { Skeleton } from '@/components/ui';
import { IconPhone, IconWhatsApp } from '@/components/icons';

export default function HelpPage() {
  const { t, tr } = usePrefs();
  const { settings } = useTemple();
  return (
    <>
      <PageTitle title={t('help')} />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {!settings ? <Skeleton className="h-60" /> : settings.faq?.map((f, i) => (
            <details key={i} className="card group p-0" open={i === 0}>
              <summary className="flex min-h-[3.5rem] cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold text-maroon">
                {tr(f.q)}
                <span className="text-2xl text-gold-dark transition group-open:rotate-45">+</span>
              </summary>
              <p className="whitespace-pre-line px-5 pb-5 text-ink-soft">{tr(f.a)}</p>
            </details>
          ))}
        </div>
        {settings && (
          <aside className="card h-fit space-y-3 p-5">
            <div className="font-display text-lg font-bold text-maroon">{t('contactTemple')}</div>
            {settings.whatsapp && (
              <a href={whatsappLink(settings.whatsapp, tr(settings.templeName))} target="_blank" rel="noreferrer" className="btn w-full bg-[#1F9D55] text-white hover:bg-[#188046]">
                <IconWhatsApp /> {t('whatsapp')}
              </a>
            )}
            {settings.phone && <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="btn-outline w-full"><IconPhone /> {settings.phone}</a>}
          </aside>
        )}
      </div>
    </>
  );
}
