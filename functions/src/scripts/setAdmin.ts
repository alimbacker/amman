/**
 * Grants (or revokes) the admin role.
 *   1. Create the admin user in Firebase Console → Authentication → Add user (email + strong password).
 *   2. export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   3. npm run set-admin -- admin@example.com          (grant)
 *      npm run set-admin -- admin@example.com --revoke (revoke)
 * The user must sign out and in again for the claim to take effect.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');
  if (!email) {
    console.error('Usage: npm run set-admin -- <email> [--revoke]');
    process.exit(1);
  }
  initializeApp();
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, revoke ? { admin: null } : { admin: true });
  // On revoke, end existing sessions so the old admin token stops working at its next refresh.
  if (revoke) await getAuth().revokeRefreshTokens(user.uid);
  await getFirestore().collection('auditLogs').add({
    action: revoke ? 'admin.revoke' : 'admin.grant',
    target: `users/${user.uid}`,
    actorUid: null,
    actorEmail: 'cli',
    details: { email },
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`${revoke ? 'Revoked' : 'Granted'} admin for ${email} (${user.uid}). Ask them to sign in again.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
