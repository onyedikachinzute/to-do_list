@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "KILLED=0"

if exist "kachisdesk.pid" (
    set /p SERVER_PID=<kachisdesk.pid
    tasklist /FI "PID eq !SERVER_PID!" 2>NUL | find "!SERVER_PID!" >NUL
    if not errorlevel 1 (
        taskkill /PID !SERVER_PID! /F >NUL 2>NUL
        set "KILLED=1"
    )
    del /f /q "kachisdesk.pid" >NUL 2>NUL
)

if "!KILLED!"=="0" (
    rem Fallback: no valid PID file, but something might still be listening
    rem on the port (e.g. left over from a crash). Find and kill that instead.
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do (
        taskkill /PID %%p /F >NUL 2>NUL
        set "KILLED=1"
    )
)

if "!KILLED!"=="1" (
    echo Kachi's Desk stopped.
) else (
    echo Kachi's Desk isn't running.
)
timeout /t 2 >NUL
