from flask import Flask, render_template, request, jsonify
from datetime import datetime
import json
import os
import sys
import threading
import webbrowser

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


if __name__ == "__main__":
    _write_pid_file()
    no_browser = "--no-browser" in sys.argv
    try:
        if not no_browser:
            _open_browser_soon()
        # use_reloader=False: prevents Flask spawning a second process,
        # which would make the PID file / stop script unreliable.
        app.run(host=HOST, port=PORT, debug=False, use_reloader=False)
    finally:
        _remove_pid_file()
