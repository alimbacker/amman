# Mobile app (Flutter) — customer

Android & iOS app for devotees. Same Firebase project, same Cloud Functions, same rules as the website.

## First-time setup

```bash
cd apps/mobile
flutter create . --org com.konnaiamman --project-name konnai_amman_ubayam --platforms android,ios
dart pub global activate flutterfire_cli
flutterfire configure --project=<your-firebase-project-id>   # writes lib/firebase_options.dart
flutter pub get
flutter test
flutter run
```

`flutter create .` only adds the missing `android/` and `ios/` folders; it does not overwrite `lib/` or `test/`.

## Android changes (required)

`android/app/src/main/AndroidManifest.xml` — inside `<manifest>` (above `<application>`):

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<queries>
  <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="upi"/></intent>
  <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="https"/></intent>
  <intent><action android:name="android.intent.action.DIAL"/><data android:scheme="tel"/></intent>
  <intent><action android:name="android.intent.action.SEND"/><data android:mimeType="text/plain"/></intent>
</queries>
```

`android/app/build.gradle(.kts)` → `minSdk = 23`.

Without the `<queries>` block, "Pay using UPI" cannot open GPay / PhonePe on Android 11+.

## iOS changes

- `ios/Runner/Info.plist`: add `LSApplicationQueriesSchemes` with `upi`, `gpay`, `phonepe`, `paytmmp`, `whatsapp`, `tel`.
- Push: enable *Push Notifications* + *Background Modes → Remote notifications* in Xcode, and upload an APNs key in Firebase Console → Project settings → Cloud Messaging.

## Structure

| File | Screens |
|---|---|
| `screens/start_screens.dart` | 1 Splash · 2 Language selection |
| `screens/shell.dart`, `home_screen.dart` | 3 Home (bottom navigation) |
| `screens/info_screens.dart` | 4 Temple info · 5 Navaratri days · 17 Help/FAQ · 18 Settings |
| `screens/booking_steps.dart` | 6 Date · 7 Time slot · 8 Ubayam · Family/Group choice · 9 Family · 10 Group · 11 Summary |
| `screens/payment_screen.dart` | 12 UPI QR payment |
| `screens/payment_submitted_screen.dart` | 13 Payment submitted |
| `screens/confirmation_screen.dart` | 14 Booking confirmation (QR, share, WhatsApp) |
| `screens/my_bookings_screen.dart` | 15 My bookings (+ find by ID & mobile) |
| `screens/booking_details_screen.dart` | 16 Booking details (live; routes to 12/13/14) |

`lib/i18n_strings.dart` is generated from `packages/shared/src/i18n.ts` — edit the TypeScript file, then run
`node --experimental-strip-types scripts/gen-dart-i18n.mjs` from the repo root.
