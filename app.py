from flask import Flask, render_template, request, jsonify
from datetime import datetime
import json
import os
import sys
import threading
import webbrowser

# Windows consoles often default to a non-UTF-8 codepage (e.g. cp1252),
# which can make print() crash the whole process the moment it hits a
# character like an em dash or emoji - with no visible error, since the
# crash happens while Python is trying to report the crash. Forcing
# UTF-8 here means that can never happen, regardless of what any print()
# statement contains later.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

# Always resolve paths relative to this file, so double-clicking from
# anywhere (Explorer, Startup folder, a shortcut) still finds the data files.
if getattr(sys, "frozen", False):
    # Running as a PyInstaller-built .exe: templates/static were bundled
    # into a temp extraction folder, but tasks.json should live next to
    # the actual .exe so your data persists between runs.
    BUNDLE_DIR = sys._MEIPASS
    BASE_DIR = os.path.dirname(os.path.abspath(sys.executable))
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR = BUNDLE_DIR

os.chdir(BASE_DIR)

app = Flask(
    __name__,
    template_folder=os.path.join(BUNDLE_DIR, "templates"),
    static_folder=os.path.join(BUNDLE_DIR, "static"),
)
TASKS_FILE = os.path.join(BASE_DIR, "tasks.json")
PID_FILE = os.path.join(BASE_DIR, "kachisdesk.pid")
PORT = 5000
HOST = "127.0.0.1"

VALID_CATEGORIES = {"Assignment", "Test", "Project", "Personal", "Other"}
VALID_PRIORITIES = {"low", "medium", "high"}

import updater

updater_checker = updater.UpdateChecker(BASE_DIR)


def load_tasks():
    if os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, "r") as f:
            tasks = json.load(f)
    else:
        tasks = []

    # Migrate legacy tasks (from the old schema) so nothing breaks.
    changed = False
    for t in tasks:
        if "category" not in t:
            t["category"] = "Other"
            changed = True
        if "priority" not in t:
            t["priority"] = "medium"
            changed = True
        if "due_date" not in t:
            t["due_date"] = None
            changed = True
        if "created_at" not in t:
            t["created_at"] = datetime.now().isoformat()
            changed = True
    if changed:
        save_tasks(tasks)
    return tasks


def save_tasks(tasks):
    with open(TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=4)


def next_id(tasks):
    return (max((t["id"] for t in tasks), default=0)) + 1


@app.route("/")
def index():
    tasks = load_tasks()
    return render_template("index.html", tasks_json=json.dumps(tasks))


@app.route("/add", methods=["POST"])
def add_task():
    data = request.get_json(silent=True) or request.form
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Task text is required"}), 400

    category = data.get("category") or "Other"
    if category not in VALID_CATEGORIES:
        category = "Other"

    priority = data.get("priority") or "medium"
    if priority not in VALID_PRIORITIES:
        priority = "medium"

    due_date = data.get("due_date") or None

    tasks = load_tasks()
    task = {
        "id": next_id(tasks),
        "text": text,
        "done": False,
        "category": category,
        "priority": priority,
        "due_date": due_date,
        "created_at": datetime.now().isoformat(),
    }
    tasks.append(task)
    save_tasks(tasks)
    return jsonify(task), 201


@app.route("/edit/<int:task_id>", methods=["POST"])
def edit_task(task_id):
    data = request.get_json(silent=True) or request.form
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if "text" in data and data.get("text", "").strip():
        task["text"] = data["text"].strip()
    if "category" in data and data.get("category") in VALID_CATEGORIES:
        task["category"] = data["category"]
    if "priority" in data and data.get("priority") in VALID_PRIORITIES:
        task["priority"] = data["priority"]
    if "due_date" in data:
        task["due_date"] = data.get("due_date") or None

    save_tasks(tasks)
    return jsonify(task)


@app.route("/delete/<int:task_id>", methods=["POST"])
def delete_task(task_id):
    tasks = load_tasks()
    tasks = [t for t in tasks if t["id"] != task_id]
    save_tasks(tasks)
    return jsonify({"ok": True})


@app.route("/toggle/<int:task_id>", methods=["POST"])
def toggle_task(task_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    task["done"] = not task["done"]
    save_tasks(tasks)
    return jsonify(task)


import socket


def _server_already_running():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex((HOST, PORT)) == 0


def _write_pid_file():
    try:
        with open(PID_FILE, "w") as f:
            f.write(str(os.getpid()))
    except OSError:
        pass


def _remove_pid_file():
    try:
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)
    except OSError:
        pass


def _open_browser_soon():
    # Give the server a moment to bind before opening the tab.
    threading.Timer(1.0, lambda: webbrowser.open(f"http://{HOST}:{PORT}/")).start()


@app.route("/api/version")
def api_version():
    return jsonify({"version": updater.APP_VERSION, "frozen": updater.IS_FROZEN})


@app.route("/api/config", methods=["GET", "POST"])
def api_config():
    if request.method == "GET":
        return jsonify(updater.load_config(BASE_DIR))

    data = request.get_json(silent=True) or {}
    cfg = updater.load_config(BASE_DIR)
    if "github_repo" in data:
        cfg["github_repo"] = (data["github_repo"] or "").strip()
    if "check_interval_hours" in data:
        try:
            cfg["check_interval_hours"] = max(0.25, float(data["check_interval_hours"]))
        except (TypeError, ValueError):
            pass
    updater.save_config(BASE_DIR, cfg)
    return jsonify(cfg)


@app.route("/api/update/status")
def api_update_status():
    return jsonify(updater_checker.get_state())


@app.route("/api/update/check", methods=["POST"])
def api_update_check():
    return jsonify(updater_checker.check_now())


@app.route("/api/update/skip", methods=["POST"])
def api_update_skip():
    state = updater_checker.get_state()
    cfg = updater.load_config(BASE_DIR)
    cfg["skip_version"] = state.get("latest_version")
    updater.save_config(BASE_DIR, cfg)
    updater_checker.state["update_available"] = False
    return jsonify({"ok": True})


@app.route("/api/update/apply", methods=["POST"])
def api_update_apply():
    state = updater_checker.get_state()

    if updater.IS_FROZEN:
        asset_url = state.get("asset_url")
        if not asset_url:
            return jsonify({"ok": False, "error": "No downloadable update found in the latest release."}), 400

        errors = []
        ok = updater.apply_update_frozen(asset_url, BASE_DIR, os.getpid(), on_error=errors.append)
        if not ok:
            return jsonify({"ok": False, "error": errors[0] if errors else "Download failed."}), 500

        threading.Timer(1.5, lambda: os._exit(0)).start()
        return jsonify({"ok": True, "message": "Updating and restarting..."})

    ok, message = updater.apply_update_script(BASE_DIR)
    status = 200 if ok else 400
    return jsonify({"ok": ok, "message": message}), status


@app.route("/api/startup/status")
def api_startup_status():
    return jsonify(updater.startup_status(BASE_DIR))


@app.route("/api/startup/enable", methods=["POST"])
def api_startup_enable():
    return jsonify(updater.startup_enable(BASE_DIR))


@app.route("/api/startup/disable", methods=["POST"])
def api_startup_disable():
    return jsonify(updater.startup_disable(BASE_DIR))


if __name__ == "__main__":
    no_browser = "--no-browser" in sys.argv

    if _server_already_running():
        # Someone double-launched us. The real server is already up and
        # healthy — don't touch its PID file, just take them to it.
        print("Kachi's Desk is already running - opening your browser instead.")
        if not no_browser:
            webbrowser.open(f"http://{HOST}:{PORT}/")
        sys.exit(0)

    _write_pid_file()
    updater_checker.start_background_loop()
    try:
        if not no_browser:
            _open_browser_soon()
        # use_reloader=False: prevents Flask spawning a second process,
        # which would make the PID file / stop script unreliable.
        app.run(host=HOST, port=PORT, debug=False, use_reloader=False)
    finally:
        _remove_pid_file()
