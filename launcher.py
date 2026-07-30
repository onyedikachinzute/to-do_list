"""
Tray launcher for Kachi's Desk.

Runs the Flask app in a background thread and shows an icon in the
Windows system tray with "Open" and "Quit" options. This is the entry
point used when building the standalone .exe with PyInstaller (see
build_exe.bat) — the resulting exe has no console window and lives in
your system tray while running.
"""
import os
import sys
import threading
import time
import webbrowser
from datetime import datetime

import pystray
from PIL import Image
from werkzeug.serving import make_server

BASE_DIR = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, "frozen", False) else __file__))
os.chdir(BASE_DIR)

from app import app, HOST, PORT, _write_pid_file, _remove_pid_file, _server_already_running, updater_checker  # noqa: E402

ICON_PATH = os.path.join(BASE_DIR, "static", "todo_icon.png")
ERROR_LOG_FILE = os.path.join(BASE_DIR, "kachisdesk_error.log")


def _log_crash(exc):
    import traceback
    try:
        with open(ERROR_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n--- {datetime.now().isoformat()} ---\n")
            traceback.print_exception(type(exc), exc, exc.__traceback__, file=f)
    except OSError:
        pass


class ServerThread(threading.Thread):
    def __init__(self, max_attempts=6, retry_delay=1.5):
        super().__init__(daemon=True)
        # make_server() binds the socket immediately, synchronously. Right
        # after a self-update swap, the old process's port may not be
        # fully released yet - retry instead of dying silently (this is
        # a --windowed build, so an unhandled exception here would
        # otherwise vanish with zero visible trace).
        last_error = None
        for attempt in range(1, max_attempts + 1):
            try:
                self.server = make_server(HOST, PORT, app)
                return
            except OSError as e:
                last_error = e
                _log_crash(e)
                if attempt < max_attempts:
                    time.sleep(retry_delay)
        raise last_error

    def run(self):
        self.server.serve_forever()

    def stop(self):
        self.server.shutdown()


def main():
    if _server_already_running():
        # Already running (e.g. exe double-clicked twice) — just surface
        # the existing instance instead of starting a second server.
        webbrowser.open(f"http://{HOST}:{PORT}/")
        return

    _write_pid_file()
    updater_checker.start_background_loop()
    server_thread = ServerThread()
    server_thread.start()
    webbrowser.open(f"http://{HOST}:{PORT}/")

    def on_open(icon, item):
        webbrowser.open(f"http://{HOST}:{PORT}/")

    def on_quit(icon, item):
        server_thread.stop()
        _remove_pid_file()
        icon.stop()

    try:
        image = Image.open(ICON_PATH)
    except Exception:
        # Fallback: a plain solid square if the icon file is missing.
        image = Image.new("RGB", (64, 64), color=(201, 161, 90))

    tray_icon = pystray.Icon(
        "kachisdesk",
        image,
        "Kachi's Desk",
        menu=pystray.Menu(
            pystray.MenuItem("Open Kachi's Desk", on_open, default=True),
            pystray.MenuItem("Quit", on_quit),
        ),
    )
    tray_icon.run()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        _log_crash(e)
        # Best-effort: still try to clean up the PID file so a future
        # launch isn't confused by a stale one.
        _remove_pid_file()
        raise
