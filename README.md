# Kachi's Desk — To-Do List

A full-stack task manager built with Flask, vanilla JS, and a JSON file store. Designed around a "late-night study desk" theme: a warm brass lamp glow behind the header brightens as you clear more tasks, giving the whole app a small, satisfying sense of progress.

**[Live demo screenshot / GIF here]**

## Features

- **Add, edit, complete, and delete tasks** — all via AJAX, no page reloads
- **Categories** (Assignment, Test, Project, Personal, Other) with color-coded task borders
- **Priority levels** (low / medium / high) shown as chips
- **Due dates** with automatic overdue / due-today detection
- **Search and filter** (All, Active, Overdue, Done)
- **Progress ring + glowing lamp** — visual feedback that scales with how much you've completed
- **Inline editing** — click the pencil icon, edit in place, blur or hit Enter to save
- **Dark / light theme toggle** with persistence across sessions
- **Fully responsive**, keyboard-accessible, and respects `prefers-reduced-motion`

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python (Flask) |
| Storage | JSON file (`tasks.json`) — swappable for a real DB later |
| Frontend | HTML5, CSS3 (custom properties, no framework), vanilla JS |
| Fonts | Fraunces (display), Inter (body), JetBrains Mono (data) |

## Running it — 3 ways

You don't need to touch a terminal for any of these once they're set up.

### Option A — double-click `start.bat` (fastest, no build step)

1. Install Python once from [python.org](https://python.org) if you don't have it (check "Add to PATH" during install).
2. Double-click `start.bat`. No console window appears — it launches the server quietly and opens your browser to the app automatically.
3. When you're done, double-click `stop.bat` to shut it down.

Running `start.bat` again while it's already open just refocuses your browser tab instead of starting a second copy.

### Option B — build a real standalone `.exe` (recommended for "portfolio" polish)

This bundles Python and everything else into one file with a proper system-tray icon (Open / Quit) — no visible console, no need for Python to be installed on the machine you copy it to.

1. On a Windows machine with Python installed, double-click `build_exe.bat`. It installs the build tools and produces `dist\KachisDesk.exe`.
2. Copy the whole `dist` folder anywhere you like (a USB stick, another PC, wherever — it's fully self-contained).
3. Double-click `KachisDesk.exe`. It opens your browser and sits as an icon in your system tray; right-click it for "Open Kachi's Desk" or "Quit".

### Option C — run it automatically every time you log in

After Option A or B, double-click `add_to_startup.bat`. It adds a shortcut to your Windows Startup folder, so the app (and tray icon, if you built the exe) is already running when you log in — no manual launch needed.

Run `remove_from_startup.bat` any time to undo this.

## Settings, startup, and auto-updates (all from within the app)

Click the ⚙ gear icon in the header — no `.bat` files or terminal needed, this works whether you're running the `.py`, `start.bat`, or the built `.exe`.

**Launch on Windows startup** — a toggle switch. Flips a registry entry (`HKCU\...\Run`) directly, no shortcut files involved. Works identically whether you're running the script or the `.exe`.

**Auto-updates** — the app already knows which repo to check for updates (`DEFAULT_GITHUB_REPO` in `updater.py`), so anyone who downloads it gets working update checks with zero setup. The GitHub repo field in Settings is only needed if someone forks the project and wants their own copy pointed at their own repo instead. From then on:
- On every launch, and every few hours after that, the app checks your repo's [latest release](https://docs.github.com/en/repositories/releasing-projects-on-github) for a newer version tag.
- If one exists, a banner appears at the top of the page and details show up in Settings (including release notes).
- Click **Update now** and it downloads the new build and restarts itself automatically — no manual download/reinstall.
- Click **Skip this version** to silence just that one release without turning off checking entirely.

**To publish an update yourself:**
1. Bump `APP_VERSION` in `updater.py`.
2. Rebuild with `build_exe.bat`.
3. On GitHub: Releases → Draft a new release → tag it (e.g. `v1.2.0`) → attach `dist\KachisDesk.exe` as a release asset → publish.

Anyone running an older build will be notified automatically next time they open the app (or within `check_interval_hours`).

*Note:* self-update only works for the built `.exe`. If you're running `app.py` directly from a `git clone`, the same "Update now" button instead runs `git pull` and restarts — it just needs the folder to actually be a git checkout.

## Keeping your task data private

`tasks.json` is in `.gitignore`, so your real tasks never get committed. A blank list is created automatically the first time the app runs if the file doesn't exist — anyone who clones the repo starts with an empty desk, or you can hand them `tasks.example.json` (rename it to `tasks.json`) for a couple of sample tasks to look at.

**If you've already pushed `tasks.json` to GitHub in a previous commit:** adding it to `.gitignore` now only stops *future* commits — the old data is still sitting in your commit history and visible on GitHub. To remove it going forward:

```bash
git rm --cached tasks.json
git commit -m "Stop tracking personal task data"
git push
```

That deletes it from the *latest* commit, but it's still recoverable from earlier commits in the repo's history. If the repo is public and you want it fully gone, you'll need to rewrite history — the simplest tool for this is [git filter-repo](https://github.com/newren/git-filter-repo):

```bash
git filter-repo --path tasks.json --invert-paths
git push --force
```

⚠️ This rewrites history and force-pushes, so only do it if you're comfortable with that (and no one else has pulled the repo). If in doubt, the safest option is just making sure the repo is private, or starting a fresh repo without the old history.

## Project structure

```
.
├── app.py                    # Flask app + JSON API (add/edit/toggle/delete)
├── launcher.py                # System-tray entry point, used to build the .exe
├── tasks.json                 # Task storage (kept next to the exe/app.py)
├── start.bat / stop.bat       # Quick launch without building anything
├── build_exe.bat              # Builds dist/KachisDesk.exe via PyInstaller
├── add_to_startup.bat / remove_from_startup.bat
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── style.css
    ├── script.js
    └── todo_icon.png
```

## API

| Method | Route | Description |
|---|---|---|
| GET | `/` | Renders the app shell with initial task data |
| POST | `/add` | Create a task — `{text, category, priority, due_date}` |
| POST | `/edit/<id>` | Update any subset of task fields |
| POST | `/toggle/<id>` | Toggle a task's `done` state |
| POST | `/delete/<id>` | Delete a task |

All endpoints accept and return JSON.

## Possible next steps

- Swap `tasks.json` for SQLite/Postgres and add user accounts
- Drag-to-reorder tasks
- Recurring tasks
- Deploy to Render / Railway / Fly.io

---

Built by Kachi.
