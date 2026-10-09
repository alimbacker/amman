'use client';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getDb } from './firebase';

/** Direct admin writes for configuration (allowed by Firestore rules for admins; audited by a trigger). */
export async function saveDoc(col: string, id: string | null, data: Record<string, unknown>): Promise<string> {
  const db = getDb();
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (id) {
    await setDoc(doc(db, col, id), payload, { merge: true });
    return id;
  }
  const r = await addDoc(collection(db, col), payload);
  return r.id;
}

export const patchDoc = (path: string, data: Record<string, unknown>) => updateDoc(doc(getDb(), path), { ...data, updatedAt: serverTimestamp() });
export const removeDoc = (path: string) => deleteDoc(doc(getDb(), path));
export const batch = () => writeBatch(getDb());
export { doc, getDb };

export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
