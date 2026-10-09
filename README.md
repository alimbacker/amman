# Sri Konnai Amman Temple · Navaratri Ubayam Booking

**ஸ்ரீ கொன்னை அம்மன் ஆலயம், கார்காத்தி** — booking system for Navaratri ubayam.

| Part | Folder | Tech |
|---|---|---|
| 🌐 Customer website (responsive) | `apps/web` | Next.js 16 · TypeScript · Tailwind (static export) |
| 🖥️ Admin dashboard | `apps/admin` | Next.js 16 · TypeScript · Tailwind (static export) |
| 📱 Customer mobile app | `apps/mobile` | Flutter (Android / iOS) |
| 🔥 Backend | `functions`, `firestore.rules`, `storage.rules` | Cloud Functions (Node 22, TS) · Firestore · Auth · Storage · FCM |
| Shared model, i18n, helpers | `packages/shared` | TypeScript (copied into functions; generated into Dart) |

All three clients use the **same Firebase project**. Nothing about the temple is hard-coded: temple name, address, phone, WhatsApp, UPI ID, QR, festival, dates, days, slots, capacity, ubayam names and prices all live in Firestore and are edited in the admin dashboard.

---

## 1. Firebase project (one time)

1. Create a project at <https://console.firebase.google.com> and switch it to the **Blaze** plan (Cloud Functions and scheduled jobs need it; a temple's traffic stays within the free quotas).
2. **Firestore** → Create database → location **asia-south1 (Mumbai)** → production mode.
3. **Authentication** → Sign-in method → enable **Anonymous** (devotees) and **Email/Password** (admins).
4. **Storage** → Get started (same region).
5. Project settings → *Your apps* → add a **Web app**; copy its config.
6. *(Recommended before going live)* **App Check** → register the web app with reCAPTCHA Enterprise and the Android/iOS apps with Play Integrity / App Attest.

## 2. Configure & deploy

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc          # put your project id; create two hosting sites (see below)
firebase hosting:sites:create konnai-amman
firebase hosting:sites:create konnai-amman-admin

npm install                                  # web + admin + shared (workspaces)
npm --prefix functions install

cp apps/web/.env.example   apps/web/.env.local     # paste the web config
cp apps/admin/.env.example apps/admin/.env.local   # same values

npm run build                                # functions + web + admin
firebase deploy                              # rules, indexes, functions, both sites
```

Indexes take a few minutes to build after the first deploy.

### Sample data and the first admin

```bash
# service account: Console → Project settings → Service accounts → Generate new private key
export GOOGLE_APPLICATION_CREDENTIALS=$PWD/service-account.json   # never commit this file

npm run seed                                 # sample settings, Navaratri 2026 (9 days × 3 slots), 4 ubayam types
# create the admin user: Console → Authentication → Add user (email + strong password), then
npm run set-admin -- admin@example.com       # grants the admin role; --revoke to remove
```

> **Check the sample dates.** The seed uses 11–19 Oct 2026 for Navaratri. Confirm with the temple's panchangam and adjust in **Admin → Festival / Days**. Replace the sample phone, WhatsApp and UPI ID in **Admin → Settings** before opening bookings.

### Mobile app

See [`apps/mobile/README.md`](apps/mobile/README.md) (`flutter create .`, `flutterfire configure`, Android `<queries>` for UPI).

### App Check (when enabled in the console)

- `functions/.env` → `ENFORCE_APP_CHECK=true`, then `firebase deploy --only functions`
- `apps/web/.env.local` → `NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...`, rebuild and redeploy the website

### Hosting the website / admin on Vercel instead of Firebase Hosting

Both apps are static exports, so they also run on Vercel — **one Vercel project per app**:

| Setting (Project → Settings) | Website | Admin |
|---|---|---|
| General → Root Directory | `apps/web` | `apps/admin` |
| General → Framework Preset | Next.js | Next.js |
| Environment Variables | all `NEXT_PUBLIC_FIREBASE_*` from `apps/web/.env.example` | same values |

Vercel detects the npm workspaces and installs from the repo root automatically. The `NEXT_PUBLIC_*` values are **inlined at build time** — `.env.local` is git-ignored, so without them in Vercel the build has no Firebase config, `getAuth()` throws `auth/invalid-api-key`, and Next.js shows its generic *"This page couldn't load"* screen. After adding or changing the variables, trigger a **Redeploy** (Deployments → ⋯ → Redeploy); a new build is required for them to take effect. Cloud Functions, rules and indexes still deploy with `firebase deploy`.

## 3. Local development

```bash
firebase emulators:start                     # auth, firestore, functions, storage
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run seed
# in apps/web/.env.local and apps/admin/.env.local: NEXT_PUBLIC_USE_EMULATORS=true
npm run dev:web     # http://localhost:3000
npm run dev:admin   # http://localhost:3001
npm test            # booking-rule unit tests
```

---

## How booking works

```
Devotee                         Cloud Functions                         Admin
───────                         ───────────────                         ─────
Day → Slot → Ubayam →
Family/Group → Details →
Summary ── createBooking ──▶  transaction: capacity check, 1 booking
                              per mobile per slot, booking ID, slot
                              count +1, hold for N minutes
Scan & Pay (UPI QR / app)
"I have paid" → UTR ── submitPayment ──▶ UTR reserved (no reuse),
                              status: Pending Verification ─────────▶ Payments → To verify
                                                                      checks bank statement
                              ◀── adminVerifyPayment(approve) ─────── Approve
Booking Confirmed + QR ◀── push notification
                              ◀── adminVerifyPayment(reject) ──────── Reject (reason)
Resubmit UTR (12 h, 3 tries)
```

- **Payment status:** `pending → paid | rejected`. **Booking status:** `pending → confirmed → completed`, or `cancelled`.
- Unpaid holds expire automatically (`expireHolds`, every 5 min) and give the place back.
- Confirmed bookings become `completed` a few hours after their slot (`completeBookings`, hourly).
- Admin can also take bookings at the counter (**Bookings → Manual booking**) and mark any pending booking **Cash received**.

## Security model

- Devotees get a silent **anonymous** Firebase identity per device. They can read only public configuration and bookings whose `viewerUids` include them. On another phone, *My Bookings → Find a booking* (booking ID + mobile) grants access.
- **Every booking/payment write goes through Cloud Functions.** Firestore rules deny all client writes to bookings, payments, families, groups, locks and counters, so nobody can mark a payment paid or change slot counts from a browser.
- Admins are Email/Password users with the `admin` custom claim (set only by the CLI script). Rules and every admin function check it. Admins edit configuration directly; rules stop them changing `bookedCount`, lowering capacity below bookings, or deleting booked slots.
- Abuse limits: per-device, per-IP and per-mobile rate limits; max unpaid holds per device, per mobile and per slot (≤ 50 % of capacity); 3 UTR attempts per booking; UTRs can't be reused.
- Audit log (**Admin → Settings → Activity log**): payment approvals/rejections, cash settlements, cancellations, manual bookings, notifications, and every configuration change (with who changed what).
- No secrets in the code. Firebase web config values are public identifiers; the service-account key is only used locally for the seed/admin scripts and is git-ignored.

## Firestore collections

`settings` · `festivals` · `festivalDays` · `ubayamTypes` · `timeSlots` · `bookings` · `families` · `familyMembers` · `groups` · `payments` · `notifications` · `users` · `auditLogs`
(internal, function-only: `bookingLocks`, `paymentTxnIds`, `counters`, `rateLimits`). Field definitions: `packages/shared/src/model.ts`.

## Known limits / next steps

- Devotees are identified by device + mobile number, not by SMS OTP. If you want "see all my bookings by mobile number on any phone", add Firebase Phone Auth (costs per SMS) and key `viewerUids` to the phone identity.
- Web push for the website is not enabled; push notifications go to the mobile app. Website users see live status on the booking page.
- The Flutter app was written against Flutter 3.29+ but has not been compiled in this environment — run `flutter analyze` and `flutter test` after `flutter pub get`.
