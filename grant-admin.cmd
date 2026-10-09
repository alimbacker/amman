@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Konnai Amman - grant admin + seed
set "EMAIL=alimbacker16@gmail.com"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm was not found. Install Node.js LTS from https://nodejs.org and run this again.
  pause & exit /b 1
)

rem --- locate the Firebase service-account key -------------------------------
set "KEY="
if exist "%~dp0service-account.json" set "KEY=%~dp0service-account.json"
if not defined KEY for %%f in ("%USERPROFILE%\Downloads\amman-17ff9-firebase-adminsdk-*.json") do set "KEY=%%~ff"
if not defined KEY (
  echo Could not find the service-account key.
  echo Save the JSON from Firebase Console ^> Project settings ^> Service accounts
  echo as "service-account.json" in this folder and run this again.
  pause & exit /b 1
)
echo Using key: !KEY!
set "GOOGLE_APPLICATION_CREDENTIALS=!KEY!"
echo.

echo [1/3] Installing backend dependencies (first time takes a minute)...
call npm --prefix functions install --no-audit --no-fund
if errorlevel 1 goto fail

echo.
echo [2/3] Granting the admin role to %EMAIL% ...
call npm run set-admin -- %EMAIL%
if errorlevel 1 goto fail
echo.
echo       Admin role granted.

echo.
echo [3/3] Loading sample festival data (settings, Navaratri days, slots, ubayam types)...
call npm run seed
if errorlevel 1 (
  echo.
  echo Seeding failed ^(admin role was still granted^). Most common cause: Firestore database
  echo not created yet - Firebase Console ^> Firestore Database ^> Create database, then re-run.
  pause & exit /b 1
)

echo.
echo ==========================================================================
echo  DONE. Open https://amman-two.vercel.app, click Sign out if signed in,
echo  then sign in again as %EMAIL% - the dashboard will open.
echo ==========================================================================
pause
exit /b 0

:fail
echo.
echo Something failed - read the message above, fix it, and run this file again.
pause
exit /b 1
