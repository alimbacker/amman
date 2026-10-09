@echo off
setlocal
cd /d "%~dp0"
title Konnai Amman - publish Firestore rules
set "PROJECT=amman-17ff9"

where npm >nul 2>&1 || (echo Node.js / npm not found. Install from https://nodejs.org & pause & exit /b 1)

echo [1/2] Signing in to Firebase (a browser window opens if needed)...
call npx -y firebase-tools@latest login
if errorlevel 1 goto fail

echo.
echo [2/2] Publishing Firestore security rules + indexes...
call npx -y firebase-tools@latest deploy --only firestore --project %PROJECT%
if errorlevel 1 goto fail

echo.
echo ==========================================================================
echo  Done. The booking engine itself runs on Vercel (/api routes), so there
echo  is nothing else to deploy here. Cloud Functions / Blaze are NOT needed.
echo ==========================================================================
pause
exit /b 0

:fail
echo.
echo Something failed - read the message above and run this file again.
pause
exit /b 1
