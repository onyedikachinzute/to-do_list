"""
Update checking + self-update, and Windows "launch on startup" toggling.

Designed to work in two run modes:
  - Frozen (.exe built by PyInstaller): updates itself by downloading the
    new .exe from a GitHub release and replacing itself via a tiny batch
    script that waits for this process to exit.
  - Script mode (python app.py): updates itself via `git pull` if the
    project folder is a git repo, then restarts itself.

Startup registration uses the HKCU Run registry key (no admin rights
needed, no shortcut/COM dependency) via the stdlib `winreg` module.
Only functional on Windows; everywhere else the functions report
"not supported" instead of crashing.
"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

APP_VERSION = "1.1.0"
RUN_KEY_NAME = "KachisDesk"

try:
    import winreg
    HAS_WINREG = True
except ImportError:
    HAS_WINREG = False

IS_FROZEN = getattr(sys, "frozen", False)


# ============================================================
# Config (github_repo, check interval) — lives next to the exe
# so it survives updates and users can edit it from Settings.
# ============================================================

def _default_config():
    return {"github_repo": "", "check_interval_hours": 6, "skip_version": None}


def load_config(base_dir):
    path = os.path.join(base_dir, "config.json")
    cfg = _default_config()
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                cfg.update(json.load(f))
        except (json.JSONDecodeError, OSError):
            pass
    return cfg


def save_config(base_dir, cfg):
    path = os.path.join(base_dir, "config.json")
    with open(path, "w") as f:
        json.dump(cfg, f, indent=4)


# ============================================================
# Version checking
# ============================================================

def _parse_version(v):
    v = (v or "").strip().lstrip("vV")
    parts = []
    for chunk in v.split("."):
        digits = "".join(ch for ch in chunk if ch.isdigit())
        parts.append(int(digits) if digits else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def is_newer(remote_version, local_version=APP_VERSION):
    return _parse_version(remote_version) > _parse_version(local_version)


def check_latest(github_repo, timeout=8):
    """Returns dict: {ok, latest_version, notes, asset_url, error}"""
    if not github_repo or "/" not in github_repo:
        return {"ok": False, "error": "No GitHub repo configured yet."}

    url = f"https://api.github.com/repos/{github_repo}/releases/latest"
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "KachisDesk-UpdateChecker",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"ok": False, "error": "No releases published on that repo yet."}
        if e.code == 403:
            return {"ok": False, "error": "GitHub is rate-limiting update checks right now — it'll try again later."}
        return {"ok": False, "error": f"GitHub returned an error ({e.code})."}
    except (urllib.error.URLError, TimeoutError, OSError):
        return {"ok": False, "error": "Couldn't reach GitHub. Check your connection."}
    except json.JSONDecodeError:
        return {"ok": False, "error": "Got an unexpected response from GitHub."}

    tag = data.get("tag_name", "")
    notes = (data.get("body") or "").strip()

    asset_url = None
    for asset in data.get("assets", []):
        name = asset.get("name", "")
        if name.lower().endswith(".exe"):
            asset_url = asset.get("browser_download_url")
            break

    return {
        "ok": True,
        "latest_version": tag,
        "notes": notes[:600],
        "asset_url": asset_url,
        "update_available": is_newer(tag),
    }


# ============================================================
# Background periodic checker
# ============================================================

class UpdateChecker:
    def __init__(self, base_dir):
        self.base_dir = base_dir
        self.state = {
            "checked_at": None,
            "update_available": False,
            "latest_version": None,
            "notes": "",
            "asset_url": None,
            "error": None,
        }
        self._lock = threading.Lock()
        self._thread = None

    def get_state(self):
        with self._lock:
            return dict(self.state)

    def check_now(self):
        cfg = load_config(self.base_dir)
        result = check_latest(cfg.get("github_repo", ""))
        with self._lock:
            self.state["checked_at"] = time.time()
            if result.get("ok"):
                skip = cfg.get("skip_version")
                available = result.get("update_available", False) and result.get("latest_version") != skip
                self.state.update({
                    "update_available": available,
                    "latest_version": result.get("latest_version"),
                    "notes": result.get("notes", ""),
                    "asset_url": result.get("asset_url"),
                    "error": None,
                })
            else:
                self.state["error"] = result.get("error")
            return dict(self.state)

    def start_background_loop(self):
        if self._thread and self._thread.is_alive():
            return

        def loop():
            # Small delay so app startup isn't blocked by a network call.
            time.sleep(5)
            while True:
                try:
                    self.check_now()
                except Exception:
                    pass
                cfg = load_config(self.base_dir)
                hours = cfg.get("check_interval_hours", 6) or 6
                time.sleep(max(hours, 0.25) * 3600)

        self._thread = threading.Thread(target=loop, daemon=True)
        self._thread.start()


# ============================================================
# Self-update
# ============================================================

def _download(url, dest_path, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "KachisDesk-Updater"})
    with urllib.request.urlopen(req, timeout=timeout) as resp, open(dest_path, "wb") as out:
        out.write(resp.read())


def apply_update_frozen(asset_url, base_dir, pid, on_error=None):
    """Downloads the new exe and spawns a batch script that waits for this
    process to exit, then swaps the exe and relaunches it."""
    import tempfile

    current_exe = os.path.abspath(sys.executable)
    tmp_dir = tempfile.gettempdir()
    new_exe_path = os.path.join(tmp_dir, "KachisDesk_update.exe")

    try:
        _download(asset_url, new_exe_path)
    except Exception as e:
        if on_error:
            on_error(str(e))
        return False

    bat_path = os.path.join(tmp_dir, "kachisdesk_apply_update.bat")
    bat_contents = f"""@echo off
:waitloop
tasklist /FI "PID eq {pid}" 2>NUL | find "{pid}" >NUL
if not errorlevel 1 (
    timeout /t 1 >NUL
    goto waitloop
)
copy /y "{new_exe_path}" "{current_exe}" >NUL
start "" "{current_exe}"
del "{new_exe_path}" >NUL 2>NUL
del "%~f0"
"""
    with open(bat_path, "w") as f:
        f.write(bat_contents)

    DETACHED_PROCESS = 0x00000008
    CREATE_NEW_PROCESS_GROUP = 0x00000200
    subprocess.Popen(
        ["cmd", "/c", bat_path],
        creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
        close_fds=True,
    )
    return True


def apply_update_script(base_dir):
    """Runs `git pull` in base_dir, then relaunches this script."""
    git_dir = os.path.join(base_dir, ".git")
    if not os.path.isdir(git_dir):
        return False, "This isn't a git checkout, so it can't self-update. Please download the latest version manually."

    try:
        result = subprocess.run(
            ["git", "pull", "--ff-only"],
            cwd=base_dir,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as e:
        return False, f"git pull failed to run: {e}"

    if result.returncode != 0:
        return False, f"git pull failed: {result.stderr.strip()[:300]}"

    def restart_soon():
        time.sleep(2)
        subprocess.Popen([sys.executable, os.path.abspath(sys.argv[0])], cwd=base_dir)
        os._exit(0)

    threading.Thread(target=restart_soon, daemon=True).start()
    return True, "Updated. Restarting..."


# ============================================================
# Windows startup registration (HKCU Run key)
# ============================================================

def _startup_command(base_dir):
    if IS_FROZEN:
        return f'"{os.path.abspath(sys.executable)}"'
    pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    if not os.path.exists(pythonw):
        pythonw = sys.executable
    script_path = os.path.join(base_dir, "app.py")
    return f'"{pythonw}" "{script_path}"'


def startup_status(base_dir):
    if not HAS_WINREG:
        return {"supported": False, "enabled": False}
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                              r"Software\Microsoft\Windows\CurrentVersion\Run",
                              0, winreg.KEY_READ)
        try:
            value, _ = winreg.QueryValueEx(key, RUN_KEY_NAME)
            enabled = bool(value)
        except FileNotFoundError:
            enabled = False
        finally:
            winreg.CloseKey(key)
        return {"supported": True, "enabled": enabled}
    except OSError:
        return {"supported": True, "enabled": False}


def startup_enable(base_dir):
    if not HAS_WINREG:
        return {"supported": False, "enabled": False, "error": "Not supported on this OS."}
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                              r"Software\Microsoft\Windows\CurrentVersion\Run",
                              0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(key, RUN_KEY_NAME, 0, winreg.REG_SZ, _startup_command(base_dir))
        winreg.CloseKey(key)
        return {"supported": True, "enabled": True}
    except OSError as e:
        return {"supported": True, "enabled": False, "error": str(e)}


def startup_disable(base_dir):
    if not HAS_WINREG:
        return {"supported": False, "enabled": False, "error": "Not supported on this OS."}
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                              r"Software\Microsoft\Windows\CurrentVersion\Run",
                              0, winreg.KEY_SET_VALUE)
        try:
            winreg.DeleteValue(key, RUN_KEY_NAME)
        except FileNotFoundError:
            pass
        winreg.CloseKey(key)
        return {"supported": True, "enabled": False}
    except OSError as e:
        return {"supported": True, "enabled": True, "error": str(e)}
