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
import webbrowser

import pystray
from PIL import Image
from werkzeug.serving import make_server

BASE_DIR = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, "frozen", False) else __file__))
os.chdir(BASE_DIR)

from app import app, HOST, PORT, _write_pid_file, _remove_pid_file  # noqa: E402

ICON_PATH = os.path.join(BASE_DIR, "static", "todo_icon.png")


class ServerThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.server = make_server(HOST, PORT, app)

    def run(self):
        self.server.serve_forever()

    def stop(self):
        self.server.shutdown()


def main():
    _write_pid_file()
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
    main()
