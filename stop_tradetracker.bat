@echo off
title TradeTracker - Stopping System...
echo =======================================================
echo          TradeTracker - Shutting Down
echo =======================================================
echo.

set STOPPED=0

REM Terminate any process on port 5000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo Stopping TradeTracker Server on PID %%a
    taskkill /F /PID %%a >nul 2>&1
    set STOPPED=1
)

REM Terminate any process on port 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Stopping Vite Frontend on PID %%a
    taskkill /F /PID %%a >nul 2>&1
    set STOPPED=1
)

echo.
if "%STOPPED%"=="1" (
    echo =======================================================
    echo  [SUCCESS] TradeTracker has been completely STOPPED.
    echo =======================================================
) else (
    echo =======================================================
    echo  [INFO] TradeTracker is not running.
    echo =======================================================
)
echo.
ping 127.0.0.1 -n 3 >nul
