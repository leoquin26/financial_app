@echo off
echo ========================================
echo    Starting Financial App with MongoDB
echo ========================================
echo.

echo [1/3] Checking MongoDB...
sc query MongoDB >nul 2>&1
if %errorlevel%==0 (
    echo MongoDB service found. Ensuring it's running...
    net start MongoDB >nul 2>&1
    echo MongoDB is running.
) else (
    echo MongoDB service not found. 
    echo Please ensure MongoDB is installed and running.
    echo Or use MongoDB Atlas cloud database.
)

echo.
echo [2/3] Starting Backend Server...
start "Backend Server - MongoDB" cmd /k "cd /d C:\Users\leona\OneDrive\Documentos\Projects\financial_app && npm run server"

timeout /t 3 /nobreak > nul

echo [3/3] Starting Frontend...
start "Frontend App" cmd /k "cd /d C:\Users\leona\OneDrive\Documentos\Projects\financial_app\client && npm start"

echo.
echo ========================================
echo    Servers are starting...
echo ========================================
echo.
echo Backend (MongoDB) will run on: http://localhost:5000
echo Frontend will run on: http://localhost:3000
echo.
echo Please wait 10-20 seconds for the frontend to compile...
echo The browser will open automatically when ready.
echo.
echo Login with:
echo   Username: demo
echo   Password: demo123
echo.
echo ========================================
echo    MongoDB Configuration
echo ========================================
echo.
echo Make sure you have created a .env file with:
echo   MONGODB_URI=mongodb://localhost:27017/financial_app
echo   (or your MongoDB Atlas connection string)
echo.
pause
