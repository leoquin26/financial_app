@echo off
echo ========================================
echo    Stopping Financial App
echo ========================================
echo.

echo Stopping processes on port 5000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F 2>nul && echo Stopped process %%a on port 5000
)

echo Stopping processes on port 3000 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F 2>nul && echo Stopped process %%a on port 3000
)

echo.
echo All servers stopped.
echo.
pause

