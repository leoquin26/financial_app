@echo off
echo Fixing development server issues...
echo.

echo Step 1: Clearing webpack cache...
cd client
rmdir /s /q node_modules\.cache 2>nul
del /q /s *.hot-update.json 2>nul
del /q /s *.hot-update.js 2>nul

echo Step 2: Clearing browser storage...
echo Please clear your browser cache and localStorage manually.
echo.

echo Step 3: Killing any stuck Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo Step 4: Restarting development server with clean cache...
set FAST_REFRESH=false
npm start

pause
