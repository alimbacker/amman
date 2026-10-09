/**
 * Creates the Firestore composite indexes from firestore.indexes.json through the Firestore Admin REST API,
 * so the dashboard works without the Firebase CLI (`firebase deploy --only firestore:indexes`).
 * Idempotent: indexes that already exist answer 409 and are skipped. New indexes take a few minutes to build.
 */
import { getApps } from 'firebase-admin/app';
import spec from '../../../firestore.indexes.json';
import { db, FieldValue } from './core';

type IndexField = { fieldPath: string; order?: string; arrayConfig?: string };
type IndexSpec = { collectionGroup: string; queryScope: string; fields: IndexField[] };
type Override = { collectionGroup: string; fieldPath: string; ttl?: boolean; indexes?: unknown[] };

async function accessToken(): Promise<string> {
  const cred = getApps()[0]?.options.credential;
  if (!cred) throw new Error('no admin credential');
  return (await cred.getAccessToken()).access_token;
}

function projectId(): string {
  return (getApps()[0]?.options.projectId as string | undefined) || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
}

export async function ensureIndexes(): Promise<{ created: number; existing: number; failed: string[] }> {
  const token = await accessToken();
  const base = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)`;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const result = { created: 0, existing: 0, failed: [] as string[] };

  for (const idx of (spec as { indexes: IndexSpec[] }).indexes) {
    const res = await fetch(`${base}/collectionGroups/${idx.collectionGroup}/indexes`, {
      method: 'POST', headers, body: JSON.stringify({ queryScope: idx.queryScope, fields: idx.fields }),
    });
    if (res.ok) result.created++;
    else if (res.status === 409) result.existing++;
    else result.failed.push(`${idx.collectionGroup}: ${res.status} ${(await res.text()).slice(0, 160)}`);
  }

  // TTL policy (rateLimits.expireAt) — a field override, not an index.
  for (const o of ((spec as { fieldOverrides?: Override[] }).fieldOverrides ?? []).filter((o) => o.ttl)) {
    const res = await fetch(`${base}/collectionGroups/${o.collectionGroup}/fields/${o.fieldPath}?updateMask.fieldPaths=ttlConfig`, {
      method: 'PATCH', headers, body: JSON.stringify({ ttlConfig: {} }),
    });
    if (!res.ok && res.status !== 409) result.failed.push(`ttl ${o.collectionGroup}.${o.fieldPath}: ${res.status}`);
  }

  await db.doc('maintenance/status').set({ indexes: { ...result, at: FieldValue.serverTimestamp() } }, { merge: true });
  return result;
}

const ONE_DAY = 24 * 3600_000;

/** Runs ensureIndexes() at most once a day unless forced (the admin shell calls this on sign-in). */
export async function ensureIndexesThrottled(force = false) {
  const ref = db.doc('maintenance/status');
  const snap = await ref.get();
  const last = (snap.data()?.indexesCheckedAt as number | undefined) ?? 0;
  if (!force && Date.now() - last < ONE_DAY) return { ran: false as const };
  await ref.set({ indexesCheckedAt: Date.now() }, { merge: true });
  return { ran: true as const, ...(await ensureIndexes()) };
}
