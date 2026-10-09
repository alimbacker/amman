'use client';
import Link from 'next/link';
import { whatsappLink } from '@temple/shared';
import { usePrefs } from '@/lib/prefs';
import { useTemple } from '@/lib/data';
import { Logo, PageTitle } from '@/components/shell';
import { Skeleton } from '@/components/ui';
import { IconCalendar, IconMapPin, IconPhone, IconWhatsApp } from '@/components/icons';

export default function TemplePage() {
  const { t, tr } = usePrefs();
  const { settings } = useTemple();
  if (!settings) return <div className="mx-auto max-w-3xl px-4 pt-10"><Skeleton className="h-80" /></div>;
  return (
    <>
      <PageTitle title={t('templeInfo')} />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[1fr_340px]">
        <article className="card overflow-hidden">
          {settings.heroImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.heroImageUrl} alt="" loading="lazy" className="aspect-[16/8] w-full object-cover" />
          )}
          <div className="p-5 md:p-8">
            <div className="flex items-center gap-4">
              <Logo size={64} />
              <div>
                <h2 className="font-display text-[1.5rem] font-bold text-maroon">{settings.templeName.ta}</h2>
                <div className="text-ink-soft">{settings.templeName.en}</div>
              </div>
            </div>
            <p className="mt-5 whitespace-pre-line text-[1.08rem] leading-relaxed text-ink">{tr(settings.about)}</p>
            <Link href="/book" className="btn-gold mt-6"><IconCalendar /> {t('bookUbayam')}</Link>
          </div>
        </article>
        <aside className="card h-fit space-y-4 p-5">
          <div className="font-display text-lg font-bold text-maroon">{t('contactTemple')}</div>
          <div className="flex gap-2 text-ink-soft"><IconMapPin className="mt-0.5 shrink-0 text-crimson" />{tr(settings.address)}</div>
          {settings.phone && <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="btn-outline w-full"><IconPhone /> {settings.phone}</a>}
          {settings.whatsapp && (
            <a href={whatsappLink(settings.whatsapp, tr(settings.templeName))} target="_blank" rel="noreferrer" className="btn w-full bg-[#1F9D55] text-white hover:bg-[#188046]">
              <IconWhatsApp /> {t('whatsapp')}
            </a>
          )}
        </aside>
      </div>
    </>
  );
}
