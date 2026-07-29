@echo off
setlocal
cd /d "%~dp0"

if not exist "kachisdesk.pid" (
    echo Kachi's Desk isn't running.
    pause
    exit /b 0
)

set /p SERVER_PID=<kachisdesk.pid
taskkill /PID %SERVER_PID% /F >NUL 2>NUL
del /f /q "kachisdesk.pid" >NUL 2>NUL
echo Kachi's Desk stopped.
timeout /t 2 >NUL
