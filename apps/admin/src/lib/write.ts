'use client';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auditConfig, getDb } from './firebase';

/** Direct admin writes for configuration (allowed by Firestore rules for admins); each one posts an audit entry. */
export async function saveDoc(col: string, id: string | null, data: Record<string, unknown>): Promise<string> {
  const db = getDb();
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (id) {
    await setDoc(doc(db, col, id), payload, { merge: true });
    auditConfig(col, id, 'update', data);
    return id;
  }
  const r = await addDoc(collection(db, col), payload);
  auditConfig(col, r.id, 'create');
  return r.id;
}

const split = (path: string) => { const [col, id] = path.split('/'); return { col, id }; };

export async function patchDoc(path: string, data: Record<string, unknown>) {
  await updateDoc(doc(getDb(), path), { ...data, updatedAt: serverTimestamp() });
  const { col, id } = split(path);
  auditConfig(col, id, 'update', data);
}
export async function removeDoc(path: string) {
  await deleteDoc(doc(getDb(), path));
  const { col, id } = split(path);
  auditConfig(col, id, 'delete');
}
/** Batched config writes (bulk slot/day creation): audited as one entry per collection once committed. */
export function batch() {
  const b = writeBatch(getDb());
  const touched = new Map<string, number>();
  const note = (ref: { path: string }) => { const col = ref.path.split('/')[0]; touched.set(col, (touched.get(col) ?? 0) + 1); };
  const commit = b.commit.bind(b);
  b.commit = async () => {
    await commit();
    touched.forEach((n, col) => auditConfig(col, 'batch', 'update', { documents: n }));
  };
  for (const m of ['set', 'update', 'delete'] as const) {
    const orig = (b[m] as (...a: unknown[]) => typeof b).bind(b);
    (b as unknown as Record<string, unknown>)[m] = (ref: { path: string }, ...rest: unknown[]) => { note(ref); return orig(ref, ...rest); };
  }
  return b;
}
export { doc, getDb };

export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
