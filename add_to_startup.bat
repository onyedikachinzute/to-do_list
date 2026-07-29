@echo off
setlocal
cd /d "%~dp0"

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if exist "dist\KachisDesk.exe" (
    set "TARGET=%CD%\dist\KachisDesk.exe"
) else (
    set "TARGET=%CD%\start.bat"
)

echo Creating shortcut in your Startup folder...
echo Target: %TARGET%

powershell -NoProfile -Command ^
    "$s = (New-Object -COM WScript.Shell).CreateShortcut('%STARTUP_DIR%\KachisDesk.lnk');" ^
    "$s.TargetPath = '%TARGET%';" ^
    "$s.WorkingDirectory = '%CD%';" ^
    "$s.WindowStyle = 7;" ^
    "$s.Save()"

echo.
echo Done. Kachi's Desk will now start automatically next time you log in.
echo To undo this, delete: %STARTUP_DIR%\KachisDesk.lnk
pause
