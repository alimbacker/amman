@echo off
setlocal
cd /d "%~dp0"
title Konnai Amman - deploy Firebase backend
set "PROJECT=amman-17ff9"

where npm >nul 2>&1 || (echo Node.js / npm not found. Install from https://nodejs.org & pause & exit /b 1)

echo [1/4] Signing in to Firebase (a browser window opens - sign in with the Google
echo       account that owns the %PROJECT% project, then come back here)...
call npx -y firebase-tools@latest login
if errorlevel 1 goto fail

echo.
echo [2/4] Publishing Firestore security rules + indexes and Storage rules...
call npx -y firebase-tools@latest deploy --only firestore,storage --project %PROJECT%
if errorlevel 1 goto fail
echo       Rules published. The admin dashboard can now read and save data.

echo.
echo [3/4] Deploying Cloud Functions (bookings, payments, notifications)...
echo       This needs the project on the Blaze (pay-as-you-go) plan. If it fails with a
echo       billing message: Firebase Console ^> Upgrade ^> Blaze, then run this file again.
call npm --prefix functions install --no-audit --no-fund
call npx -y firebase-tools@latest deploy --only functions --project %PROJECT%
if errorlevel 1 (
  echo.
  echo Functions did not deploy ^(rules are already live^). See the message above.
  pause & exit /b 1
)

echo.
echo [4/4] Done.
echo ==========================================================================
echo  Reload https://amman-two.vercel.app - the dashboard should show the
echo  sample Navaratri festival. Indexes keep building for a few minutes.
echo ==========================================================================
pause
exit /b 0

:fail
echo.
echo Something failed - read the message above and run this file again.
pause
exit /b 1
