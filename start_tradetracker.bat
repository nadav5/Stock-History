@echo off
title TradeTracker Server & Application
echo =======================================================
echo          TradeTracker - Launching Full-Stack
echo =======================================================
echo.

cd /d "%~dp0"

REM 1. Check if MongoDB service is running
echo [1/3] Checking MongoDB Database service...
sc query mongodb | findstr "RUNNING" >nul
if %errorlevel% neq 0 (
    echo Starting MongoDB service...
    net start mongodb >nul 2>&1
)
echo [OK] MongoDB is running.

REM 2. Terminate any previous instance on port 5000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM 3. Build dist if missing
if not exist "%~dp0backend\dist\server.js" (
    echo [Build] Compiling backend TypeScript...
    call npm --prefix "%~dp0backend" run build
)
if not exist "%~dp0frontend\dist\index.html" (
    echo [Build] Compiling frontend bundle...
    call npm --prefix "%~dp0frontend" run build
)

REM 3. Open browser after short delay in background
start "" cmd /c "ping 127.0.0.1 -n 4 >nul && start http://localhost:5000"

REM 4. Launch TradeTracker in this window
echo [2/3] Starting TradeTracker Engine on http://localhost:5000 ...
echo [3/3] Your browser will open automatically at http://localhost:5000
echo.
echo =======================================================
echo  TradeTracker is RUNNING!
echo  URL: http://localhost:5000
echo  Portfolio Tracker: Ready (Starts empty, 1-click Blink import or Excel upload)
echo.
echo  To STOP the system:
echo  - Close this window or press Ctrl+C, OR
echo  - Double-click: stop_tradetracker.bat
echo =======================================================
echo.

cd /d "%~dp0backend"
node dist/server.js
