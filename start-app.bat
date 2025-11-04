@echo off
echo ========================================
echo    Starting Financial App
echo ========================================
echo.

echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "cd /d C:\Users\leona\OneDrive\Documentos\Projects\financial_app && npm run server"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend...
start "Frontend App" cmd /k "cd /d C:\Users\leona\OneDrive\Documentos\Projects\financial_app\client && npm start"

echo.
echo ========================================
echo    Servers are starting...
echo ========================================
echo.
echo Backend will run on: http://localhost:5000
echo Frontend will run on: http://localhost:3000
echo.
echo Please wait 10-20 seconds for the frontend to compile...
echo The browser will open automatically when ready.
echo.
echo Login with:
echo   Username: demo
echo   Password: demo123
echo.
pause

