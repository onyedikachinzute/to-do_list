@echo off
setlocal
cd /d "%~dp0"

where pythonw >NUL 2>NUL
if errorlevel 1 (
    echo Python was not found on this computer.
    echo Install it from https://python.org, then run this file again.
    pause
    exit /b 1
)

rem app.py checks for itself whether it's already running on port 5000 —
rem if so it just opens your browser instead of starting a duplicate.
rem pythonw = no console window pops up.
start "" pythonw app.py
exit /b 0
