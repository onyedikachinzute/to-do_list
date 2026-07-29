@echo off
setlocal
cd /d "%~dp0"

rem If it's already running, just focus the browser tab instead of starting a second copy.
if exist "kachisdesk.pid" (
    set /p EXISTING_PID=<kachisdesk.pid
    tasklist /FI "PID eq %EXISTING_PID%" 2>NUL | find "%EXISTING_PID%" >NUL
    if not errorlevel 1 (
        start "" "http://127.0.0.1:5000/"
        exit /b 0
    )
)

where pythonw >NUL 2>NUL
if errorlevel 1 (
    echo Python was not found on this computer.
    echo Install it from https://python.org, then run this file again.
    pause
    exit /b 1
)

rem pythonw = no console window pops up
start "" pythonw app.py
exit /b 0
