@echo off
setlocal
cd /d "%~dp0"

echo Installing build dependencies...
pip install -r requirements.txt
pip install pyinstaller pystray pillow

echo.
echo Building KachisDesk.exe ...
pyinstaller --noconfirm --onefile --windowed --name "KachisDesk" ^
    --icon "static\todo_icon.png" ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    launcher.py

echo.
echo Copying data files next to the exe...
copy /y tasks.json dist\tasks.json >NUL
if exist config.json (
    copy /y config.json dist\config.json >NUL
) else (
    echo {"github_repo": "", "check_interval_hours": 6, "skip_version": null} > dist\config.json
)

echo.
echo Done. Your app is at: dist\KachisDesk.exe
echo Copy the whole "dist" folder wherever you like, then run KachisDesk.exe.
pause
