@echo off
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_DIR%\KachisDesk.lnk" (
    del /f /q "%STARTUP_DIR%\KachisDesk.lnk"
    echo Removed from startup.
) else (
    echo Kachi's Desk wasn't set to start up automatically.
)
pause
