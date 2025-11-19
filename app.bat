@echo off
setlocal enabledelayedexpansion

:: Financial App - All-in-One Control with Docker Support
:: Usage: app.bat [start|stop|restart|status|docker|docker-stop]

set "command=%1"

:: Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel%==0 (
    set docker_available=1
) else (
    set docker_available=0
)

:: If no command provided, show menu
if "%command%"=="" (
    goto :menu
)

:: Convert to lowercase
set "command=%command:A=a%"
set "command=%command:B=b%"
set "command=%command:C=c%"
set "command=%command:D=d%"
set "command=%command:E=e%"
set "command=%command:F=f%"
set "command=%command:G=g%"
set "command=%command:H=h%"
set "command=%command:I=i%"
set "command=%command:J=j%"
set "command=%command:K=k%"
set "command=%command:L=l%"
set "command=%command:M=m%"
set "command=%command:N=n%"
set "command=%command:O=o%"
set "command=%command:P=p%"
set "command=%command:Q=q%"
set "command=%command:R=r%"
set "command=%command:S=s%"
set "command=%command:T=t%"
set "command=%command:U=u%"
set "command=%command:V=v%"
set "command=%command:W=w%"
set "command=%command:X=x%"
set "command=%command:Y=y%"
set "command=%command:Z=z%"

if "%command%"=="start" goto :start
if "%command%"=="stop" goto :stop
if "%command%"=="restart" goto :restart
if "%command%"=="status" goto :status
if "%command%"=="docker" goto :docker_start
if "%command%"=="docker-stop" goto :docker_stop
if "%command%"=="docker-status" goto :docker_status
goto :menu

:menu
cls
echo.
echo  ============================================
echo     FINANCIAL APP CONTROL CENTER
echo  ============================================
echo.
call :check_ports
echo  Current Status:
if !backend_running!==1 (
    echo    [92m● Backend:  RUNNING[0m
) else (
    echo    [91m● Backend:  STOPPED[0m
)
if !frontend_running!==1 (
    echo    [92m● Frontend: RUNNING[0m
) else (
    echo    [91m● Frontend: STOPPED[0m
)

:: Check Docker status
if !docker_available!==1 (
    echo.
    echo  Docker Status:
    docker ps --format "table {{.Names}}\t{{.Status}}" 2>nul | findstr "financial-app" >nul
    if !errorlevel!==0 (
        echo    [92m● Docker:   CONTAINERS RUNNING[0m
    ) else (
        echo    [91m● Docker:   NO CONTAINERS[0m
    )
)

echo.
echo  ============================================
echo.
echo  LOCAL DEVELOPMENT:
echo  [1] Start App (Local)
echo  [2] Stop App (Local)
echo  [3] Restart App (Local)
echo  [4] Check Status
echo.
if !docker_available!==1 (
    echo  DOCKER:
    echo  [5] Start with Docker
    echo  [6] Stop Docker Containers
    echo  [7] Docker Status
    echo.
)
echo  OTHER:
echo  [8] Open in Browser
echo  [9] Exit
echo.
set /p "choice=Enter your choice: "

if "%choice%"=="1" goto :start
if "%choice%"=="2" goto :stop
if "%choice%"=="3" goto :restart
if "%choice%"=="4" goto :status
if "%choice%"=="5" if !docker_available!==1 goto :docker_start
if "%choice%"=="6" if !docker_available!==1 goto :docker_stop
if "%choice%"=="7" if !docker_available!==1 goto :docker_status
if "%choice%"=="8" (
    start http://localhost:3000
    goto :menu
)
if "%choice%"=="9" goto :end

echo Invalid choice. Press any key to continue...
pause >nul
goto :menu

:docker_start
cls
echo.
echo  [94m╔════════════════════════════════╗[0m
echo  [94m║  STARTING APP WITH DOCKER      ║[0m
echo  [94m╚════════════════════════════════╝[0m
echo.

:: Check if docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo  [91m❌ docker-compose.yml not found![0m
    echo.
    pause
    goto :menu
)

:: Stop any local instances first
call :check_ports
if !backend_running!==1 (
    echo  [93m⚠ Stopping local backend first...[0m
    call :stop_services
)

echo  [96m🐳 Building Docker images...[0m
docker-compose build

echo.
echo  [96m🚀 Starting Docker containers...[0m
docker-compose up -d

echo.
echo  [92m✅ Docker containers started![0m
echo.
echo  Services:
echo    MongoDB:  http://localhost:27017
echo    Backend:  http://localhost:5000
echo    Frontend: http://localhost:3000
echo.
echo  [96m⏳ Waiting for services to start...[0m
timeout /t 10 /nobreak >nul

echo  [96m🌐 Opening browser...[0m
start http://localhost:3000

echo.
pause
goto :menu

:docker_stop
cls
echo.
echo  [93m╔════════════════════════════════╗[0m
echo  [93m║  STOPPING DOCKER CONTAINERS    ║[0m
echo  [93m╚════════════════════════════════╝[0m
echo.

echo  [93m🛑 Stopping Docker containers...[0m
docker-compose down

echo.
echo  [92m✅ Docker containers stopped![0m

echo.
pause
goto :menu

:docker_status
cls
echo.
echo  [96m╔════════════════════════════════╗[0m
echo  [96m║    DOCKER CONTAINER STATUS     ║[0m
echo  [96m╚════════════════════════════════╝[0m
echo.

echo  [96m🐳 Docker Containers:[0m
echo.
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | findstr "NAME financial-app"

echo.
echo  [96m📊 Docker Resources:[0m
docker ps --format "table {{.Names}}\t{{.Size}}" | findstr "NAME financial-app"

echo.
echo  [96m🔍 Docker Compose Status:[0m
docker-compose ps

echo.
pause
goto :menu

:start
cls
echo.
echo  [94m╔════════════════════════════════╗[0m
echo  [94m║  STARTING APP (LOCAL)          ║[0m
echo  [94m╚════════════════════════════════╝[0m
echo.

:: Check if already running
call :check_ports
if !backend_running!==1 (
    echo  [93m⚠ Backend is already running[0m
    if "%1"=="" (
        echo.
        pause
        goto :menu
    ) else (
        goto :end
    )
)

:: Check MongoDB
echo  [96m🔍 Checking MongoDB connection...[0m
:: Try to connect to MongoDB (you'll need to update with your connection string)
echo.

:: Install dependencies if needed
if not exist "node_modules" (
    echo  [96m📦 Installing root dependencies...[0m
    call npm install
)

if not exist "client\node_modules" (
    echo  [96m📦 Installing client dependencies...[0m
    cd client
    call npm install --legacy-peer-deps
    cd ..
)

:: Start services
echo.
echo  [96m🚀 Starting Backend Server...[0m
start /min cmd /c "cd /d "%cd%" && npm run server"

echo  [96m⏳ Waiting for backend...[0m
timeout /t 5 /nobreak >nul

echo  [96m🚀 Starting Frontend App...[0m
start /min cmd /c "cd /d "%cd%" && npm run client"

echo.
echo  [92m✅ Financial App Started Successfully![0m
echo.
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:3000
echo.
echo  [93m⚠ Note: Make sure MongoDB is running![0m
echo.
echo  [96m🌐 Opening browser...[0m
timeout /t 3 /nobreak >nul
start http://localhost:3000

if "%1"=="" (
    echo.
    pause
    goto :menu
)
goto :end

:stop
cls
echo.
echo  [93m╔════════════════════════════════╗[0m
echo  [93m║  STOPPING APP (LOCAL)          ║[0m
echo  [93m╚════════════════════════════════╝[0m
echo.

call :stop_services
echo  [92m✅ All services stopped![0m

if "%1"=="" (
    echo.
    pause
    goto :menu
)
goto :end

:restart
cls
echo.
echo  [93m╔════════════════════════════════╗[0m
echo  [93m║  RESTARTING APP (LOCAL)        ║[0m
echo  [93m╚════════════════════════════════╝[0m
echo.

echo  [93m🛑 Stopping services...[0m
call :stop_services

echo  [96m⏳ Waiting for cleanup...[0m
timeout /t 2 /nobreak >nul

goto :start

:status
cls
echo.
echo  [96m╔════════════════════════════════╗[0m
echo  [96m║    APP STATUS                  ║[0m
echo  [96m╚════════════════════════════════╝[0m
echo.

call :check_ports

echo  [96mLocal Services:[0m
echo  ═══════════════════════════════════
if !backend_running!==1 (
    echo  [92m● Backend Server  - RUNNING (Port 5000)[0m
) else (
    echo  [91m● Backend Server  - STOPPED (Port 5000)[0m
)

if !frontend_running!==1 (
    echo  [92m● Frontend App    - RUNNING (Port 3000)[0m
) else (
    echo  [91m● Frontend App    - STOPPED (Port 3000)[0m
)

echo.

if !docker_available!==1 (
    echo  [96mDocker Services:[0m
    echo  ═══════════════════════════════════
    docker ps --format "table {{.Names}}\t{{.Status}}" | findstr "financial-app"
    echo.
)

echo  [96mURLs:[0m
echo  ═══════════════════════════════════
echo  Backend API: http://localhost:5000
echo  Frontend:    http://localhost:3000
echo  MongoDB:     mongodb://localhost:27017
echo.

if "%1"=="" (
    pause
    goto :menu
)
goto :end

:stop_services
:: Kill backend processes (port 5000)
echo  [93m🛑 Stopping backend server...[0m
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        taskkill /PID %%a /F >nul 2>&1
    )
)

:: Kill frontend processes (port 3000)
echo  [93m🛑 Stopping frontend app...[0m
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        taskkill /PID %%a /F >nul 2>&1
    )
)

:: Kill any node processes started by npm
echo  [93m🧹 Cleaning up Node processes...[0m
wmic process where "commandline like '%%financ%%' and name='node.exe'" delete >nul 2>&1

:: Give processes time to clean up
timeout /t 2 /nobreak >nul
goto :eof

:check_ports
set backend_running=0
set frontend_running=0

:: Check port 5000
netstat -ano | findstr :5000 | findstr LISTENING >nul 2>&1
if %errorlevel%==0 set backend_running=1

:: Check port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel%==0 set frontend_running=1

goto :eof

:end
endlocal