const logger = { warn: (...a: unknown[]) => console.warn(...a), info: (...a: unknown[]) => console.info(...a), error: (...a: unknown[]) => console.error(...a) };
import { db, FieldValue, messaging } from './core';
import type { Bilingual, Lang } from '@temple/shared';

const INVALID_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** Push a localised message to every device of the given users; prunes dead tokens. */
export async function pushToUsers(uids: string[], title: Bilingual, body: Bilingual, data: Record<string, string> = {}) {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length) return;
  const snaps = await db.getAll(...unique.map((u) => db.doc(`users/${u}`)));
  for (const snap of snaps) {
    const u = snap.data() as { fcmTokens?: string[]; lang?: Lang } | undefined;
    const tokens = u?.fcmTokens ?? [];
    if (!tokens.length) continue;
    const lang: Lang = u?.lang === 'en' ? 'en' : 'ta';
    try {
      const res = await messaging().sendEachForMulticast({
        tokens,
        notification: { title: title[lang] || title.ta, body: body[lang] || body.ta },
        data,
        android: { priority: 'high' },
      });
      const dead = res.responses
        .map((r, i) => (!r.success && r.error && INVALID_TOKEN_ERRORS.has(r.error.code) ? tokens[i] : null))
        .filter((t): t is string => !!t);
      if (dead.length) await snap.ref.update({ fcmTokens: FieldValue.arrayRemove(...dead) });
    } catch (e) {
      logger.warn('push failed', { uid: snap.id, e });
    }
  }
}

export async function pushToAll(title: Bilingual, body: Bilingual) {
  await Promise.all(
    (['ta', 'en'] as const).map((lang) =>
      messaging().send({
        topic: `announcements_${lang}`,
        notification: { title: title[lang] || title.ta, body: body[lang] || body.ta },
        android: { priority: 'high' },
      }),
    ),
  );
}

export const bookingMessages = {
  confirmed: (id: string) => ({
    title: { ta: 'பதிவு உறுதி செய்யப்பட்டது 🙏', en: 'Booking confirmed 🙏' },
    body: { ta: `உங்கள் உபயம் பதிவு ${id} உறுதி செய்யப்பட்டது.`, en: `Your ubayam booking ${id} is confirmed.` },
  }),
  rejected: (id: string) => ({
    title: { ta: 'கட்டணம் சரிபார்க்க இயலவில்லை', en: 'Payment could not be verified' },
    body: { ta: `பதிவு ${id}: பரிவர்த்தனை எண்ணைச் சரிபார்த்து மீண்டும் சமர்ப்பிக்கவும்.`, en: `Booking ${id}: please check your transaction ID and resubmit.` },
  }),
  cancelled: (id: string) => ({
    title: { ta: 'பதிவு ரத்து செய்யப்பட்டது', en: 'Booking cancelled' },
    body: { ta: `உங்கள் பதிவு ${id} ரத்து செய்யப்பட்டது.`, en: `Your booking ${id} has been cancelled.` },
  }),
};
