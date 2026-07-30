document.addEventListener("DOMContentLoaded", () => {
  const yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  const CATEGORY_COLORS = {
    Assignment: "#c9a15a",
    Test: "#e2725b",
    Project: "#7fa98a",
    Personal: "#8b9dc3",
    Other: "#8b8ea3",
  };

  let tasks = [];
  try {
    tasks = JSON.parse(document.getElementById("initial-tasks").textContent || "[]");
  } catch (e) {
    tasks = [];
  }

  let currentFilter = "active";
  let currentSearch = "";

  const taskList = document.getElementById("taskList");
  const emptyState = document.getElementById("emptyState");
  const template = document.getElementById("taskTemplate");
  const ringFill = document.getElementById("ringFill");
  const ringLabel = document.getElementById("ringLabel");
  const progressHeadline = document.getElementById("progressHeadline");
  const progressSub = document.getElementById("progressSub");
  const lampGlow = document.getElementById("lampGlow");
  const RING_CIRCUMFERENCE = 169.6;

  // ---------- Theme ----------
  const toggle = document.getElementById("theme-toggle");
  const body = document.body;
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") body.classList.add("light");

  toggle.addEventListener("click", () => {
    body.classList.toggle("light");
    localStorage.setItem("theme", body.classList.contains("light") ? "light" : "dark");
  });

  // ---------- Date helpers ----------
  function dueStatus(dueDateStr) {
    if (!dueDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr + "T00:00:00");
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return "overdue";
    if (diffDays === 0) return "today";
    return "upcoming";
  }

  function formatDue(dueDateStr) {
    const due = new Date(dueDateStr + "T00:00:00");
    return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // ---------- Rendering ----------
  function matchesFilter(task) {
    if (currentFilter === "active" && task.done) return false;
    if (currentFilter === "done" && !task.done) return false;
    if (currentFilter === "overdue" && (task.done || dueStatus(task.due_date) !== "overdue")) return false;
    if (currentSearch && !task.text.toLowerCase().includes(currentSearch)) return false;
    return true;
  }

  function buildTaskNode(task) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.style.setProperty("--cat-color", CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Other);
    if (task.done) node.classList.add("done");

    node.querySelector(".task-text").textContent = task.text;

    const catChip = node.querySelector(".chip-category");
    catChip.textContent = task.category;

    const prioChip = node.querySelector(".chip-priority");
    prioChip.textContent = task.priority;
    prioChip.dataset.priority = task.priority;

    const dueChip = node.querySelector(".chip-due");
    if (task.due_date) {
      const status = dueStatus(task.due_date);
      dueChip.textContent = (status === "overdue" ? "overdue · " : status === "today" ? "today · " : "") + formatDue(task.due_date);
      dueChip.dataset.status = status;
    } else {
      dueChip.remove();
    }

    node.querySelector(".toggle-btn").addEventListener("click", () => toggleTask(task.id, node));
    node.querySelector(".delete-btn").addEventListener("click", () => deleteTask(task.id, node));
    node.querySelector(".edit-btn").addEventListener("click", () => startEdit(task, node));

    return node;
  }

  function render() {
    taskList.innerHTML = "";
    const visible = tasks.filter(matchesFilter);

    visible.forEach((task, i) => {
      const node = buildTaskNode(task);
      node.classList.add("task-enter");
      node.style.animationDelay = `${i * 0.04}s`;
      taskList.appendChild(node);
    });

    emptyState.hidden = visible.length > 0;
    if (tasks.length === 0) {
      emptyState.textContent = "Your desk is clear. Add a task to get the lamp glowing.";
    } else if (visible.length === 0) {
      if (currentSearch) {
        emptyState.textContent = "Nothing matches your search.";
      } else if (currentFilter === "active") {
        emptyState.textContent = "All caught up. Nothing active right now.";
      } else if (currentFilter === "overdue") {
        emptyState.textContent = "Nothing overdue. You're on top of things.";
      } else if (currentFilter === "done") {
        emptyState.textContent = "Nothing completed yet — get to it.";
      } else {
        emptyState.textContent = "Nothing here.";
      }
    }

    updateProgress();
  }

  function updateProgress() {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const offset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * pct) / 100;
    ringFill.style.strokeDashoffset = offset;
    ringLabel.textContent = `${pct}%`;

    lampGlow.style.setProperty("--glow-opacity", (0.08 + (pct / 100) * 0.34).toFixed(2));

    if (total === 0) {
      progressHeadline.textContent = "Nothing lit yet.";
      progressSub.textContent = "Add a task to get started.";
    } else if (done === total) {
      progressHeadline.textContent = "Desk fully cleared. Nice work.";
      progressSub.textContent = `${total} of ${total} tasks done.`;
    } else {
      progressHeadline.textContent = `${done} of ${total} tasks cleared.`;
      const overdue = tasks.filter((t) => !t.done && dueStatus(t.due_date) === "overdue").length;
      progressSub.textContent = overdue > 0 ? `${overdue} overdue — worth a look.` : "Keep going.";
    }
  }

  // ---------- Filters & search ----------
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      currentFilter = tab.dataset.filter;
      render();
    });
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    render();
  });

  // ---------- Drawers (Add task / Settings) share one backdrop ----------
  const fab = document.getElementById("addFab");
  const addDrawer = document.getElementById("addDrawer");
  const settingsDrawer = document.getElementById("settingsDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  const addForm = document.getElementById("addForm");
  let openDrawerEl = null;

  function openDrawer(drawerEl, focusEl) {
    if (openDrawerEl) openDrawerEl.hidden = true;
    drawerEl.hidden = false;
    backdrop.hidden = false;
    openDrawerEl = drawerEl;
    if (focusEl) focusEl.focus();
  }
  function closeDrawer() {
    if (openDrawerEl) openDrawerEl.hidden = true;
    backdrop.hidden = true;
    openDrawerEl = null;
  }

  fab.addEventListener("click", () => openDrawer(addDrawer, document.getElementById("taskText")));
  backdrop.addEventListener("click", closeDrawer);
  document.getElementById("cancelAdd").addEventListener("click", () => { addForm.reset(); closeDrawer(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openDrawerEl) closeDrawer();
  });

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      text: document.getElementById("taskText").value.trim(),
      category: document.getElementById("taskCategory").value,
      priority: document.getElementById("taskPriority").value,
      due_date: document.getElementById("taskDue").value || null,
    };
    if (!payload.text) return;

    try {
      const res = await fetch("/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Add failed");
      const newTask = await res.json();
      tasks.push(newTask);
      addForm.reset();
      closeDrawer();
      render();
    } catch (err) {
      console.error(err);
      alert("Couldn't add that task. Try again?");
    }
  });


  // ---------- Toggle / delete / edit ----------
  async function toggleTask(id, node) {
    try {
      const res = await fetch(`/toggle/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Toggle failed");
      const updated = await res.json();
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx > -1) tasks[idx] = updated;

      const stillVisible = matchesFilter(updated);

      if (!stillVisible) {
        // Slide right when moving toward "done", left when moving back to "active".
        const exitClass = updated.done ? "task-complete-exit" : "task-return-exit";
        node.classList.add(exitClass);
        node.addEventListener("animationend", () => render(), { once: true });
      } else {
        node.classList.add("task-pulse");
        setTimeout(() => node.classList.remove("task-pulse"), 400);
        render();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteTask(id, node) {
    node.classList.add("task-exit");
    node.addEventListener("animationend", async () => {
      try {
        const res = await fetch(`/delete/${id}`, { method: "POST" });
        if (!res.ok) throw new Error("Delete failed");
        tasks = tasks.filter((t) => t.id !== id);
        render();
      } catch (err) {
        console.error(err);
      }
    }, { once: true });
  }

  function startEdit(task, node) {
    node.classList.add("editing");
    const textEl = node.querySelector(".task-text");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "task-edit-input";
    input.value = task.text;
    textEl.insertAdjacentElement("afterend", input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    async function commit() {
      const newText = input.value.trim();
      input.removeEventListener("blur", commit);
      if (!newText || newText === task.text) {
        node.classList.remove("editing");
        input.remove();
        return;
      }
      try {
        const res = await fetch(`/edit/${task.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: newText }),
        });
        if (!res.ok) throw new Error("Edit failed");
        const updated = await res.json();
        const idx = tasks.findIndex((t) => t.id === task.id);
        if (idx > -1) tasks[idx] = updated;
      } catch (err) {
        console.error(err);
      }
      render();
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") {
        input.removeEventListener("blur", commit);
        node.classList.remove("editing");
        input.remove();
      }
    });
  }

  // ---------- Settings drawer: startup toggle + updates ----------
  const settingsToggleBtn = document.getElementById("settings-toggle");
  const closeSettingsBtn = document.getElementById("closeSettings");
  const startupSwitch = document.getElementById("startupSwitch");
  const startupSub = document.getElementById("startupSub");
  const versionLabel = document.getElementById("versionLabel");
  const updateStatusText = document.getElementById("updateStatusText");
  const checkUpdateBtn = document.getElementById("checkUpdateBtn");
  const updateAvailableBox = document.getElementById("updateAvailableBox");
  const updateBoxVersion = document.getElementById("updateBoxVersion");
  const updateBoxNotes = document.getElementById("updateBoxNotes");
  const applyUpdateBtn = document.getElementById("applyUpdateBtn");
  const skipUpdateBtn = document.getElementById("skipUpdateBtn");
  const githubRepoInput = document.getElementById("githubRepoInput");
  const saveConfigBtn = document.getElementById("saveConfigBtn");
  const updateBanner = document.getElementById("updateBanner");
  const updateBannerVersion = document.getElementById("updateBannerVersion");

  let localVersion = "—";

  settingsToggleBtn.addEventListener("click", async () => {
    openDrawer(settingsDrawer);
    refreshStartupStatus();
    refreshVersionAndConfig();
  });
  closeSettingsBtn.addEventListener("click", closeDrawer);

  async function refreshStartupStatus() {
    try {
      const res = await fetch("/api/startup/status");
      const data = await res.json();
      applyStartupState(data);
    } catch (err) {
      startupSub.textContent = "Couldn't check startup status.";
    }
  }

  function applyStartupState(data) {
    if (!data.supported) {
      startupSub.textContent = "Not supported on this system.";
      startupSwitch.disabled = true;
      return;
    }
    startupSwitch.setAttribute("aria-checked", String(!!data.enabled));
    startupSwitch.classList.toggle("is-on", !!data.enabled);
    startupSub.textContent = data.enabled
      ? "Kachi's Desk opens automatically when you log in."
      : "Off — you'll need to open it yourself.";
  }

  startupSwitch.addEventListener("click", async () => {
    const currentlyOn = startupSwitch.classList.contains("is-on");
    startupSub.textContent = "Updating…";
    try {
      const res = await fetch(currentlyOn ? "/api/startup/disable" : "/api/startup/enable", { method: "POST" });
      const data = await res.json();
      applyStartupState(data);
    } catch (err) {
      startupSub.textContent = "Something went wrong. Try again?";
    }
  });

  async function refreshVersionAndConfig() {
    try {
      const [vRes, cRes] = await Promise.all([fetch("/api/version"), fetch("/api/config")]);
      const vData = await vRes.json();
      const cData = await cRes.json();
      localVersion = vData.version;
      versionLabel.textContent = `v${localVersion}`;
      githubRepoInput.value = cData.github_repo || "";
      githubRepoInput.placeholder = cData.effective_repo
        ? `Using: ${cData.effective_repo}`
        : "e.g. kachi/kachis-desk-todo";
    } catch (err) {
      versionLabel.textContent = "v?";
    }
    refreshUpdateStatus();
  }

  function renderUpdateState(state) {
    if (state.error) {
      updateStatusText.textContent = state.error;
      updateAvailableBox.hidden = true;
      updateBanner.hidden = true;
      return;
    }
    if (state.update_available) {
      updateStatusText.textContent = "An update is ready to install.";
      updateAvailableBox.hidden = false;
      updateBoxVersion.textContent = state.latest_version || "";
      updateBoxNotes.textContent = state.notes || "";
      updateBannerVersion.textContent = state.latest_version ? ` (${state.latest_version})` : "";
      updateBanner.hidden = false;
    } else {
      updateStatusText.textContent = state.checked_at ? "You're on the latest version." : "Checking for updates…";
      updateAvailableBox.hidden = true;
      updateBanner.hidden = true;
    }
  }

  async function refreshUpdateStatus() {
    try {
      const res = await fetch("/api/update/status");
      renderUpdateState(await res.json());
    } catch (err) {
      updateStatusText.textContent = "Couldn't check update status.";
    }
  }

  checkUpdateBtn.addEventListener("click", async () => {
    updateStatusText.textContent = "Checking…";
    try {
      const res = await fetch("/api/update/check", { method: "POST" });
      renderUpdateState(await res.json());
    } catch (err) {
      updateStatusText.textContent = "Couldn't reach GitHub.";
    }
  });

  applyUpdateBtn.addEventListener("click", async () => {
    applyUpdateBtn.disabled = true;
    applyUpdateBtn.textContent = "Updating…";
    try {
      const res = await fetch("/api/update/apply", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        updateStatusText.textContent = "Restarting with the new version — this page will reconnect shortly.";
        // The server process is about to exit and relaunch; poll until it's back.
        setTimeout(() => {
          const retry = setInterval(() => {
            fetch("/api/version").then(() => { clearInterval(retry); location.reload(); }).catch(() => {});
          }, 1500);
        }, 2000);
      } else {
        updateStatusText.textContent = data.error || "Update failed.";
        applyUpdateBtn.disabled = false;
        applyUpdateBtn.textContent = "Update now";
      }
    } catch (err) {
      updateStatusText.textContent = "Update failed. Try again?";
      applyUpdateBtn.disabled = false;
      applyUpdateBtn.textContent = "Update now";
    }
  });

  skipUpdateBtn.addEventListener("click", async () => {
    await fetch("/api/update/skip", { method: "POST" });
    updateAvailableBox.hidden = true;
    updateBanner.hidden = true;
    updateStatusText.textContent = "Skipped — you won't be notified about this version again.";
  });

  saveConfigBtn.addEventListener("click", async () => {
    saveConfigBtn.disabled = true;
    saveConfigBtn.textContent = "Saving…";
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_repo: githubRepoInput.value.trim() }),
      });
      refreshUpdateStatus();
    } finally {
      saveConfigBtn.disabled = false;
      saveConfigBtn.textContent = "Save";
    }
  });

  document.getElementById("updateBannerDismiss").addEventListener("click", () => {
    updateBanner.hidden = true;
  });
  document.getElementById("updateBannerView").addEventListener("click", () => {
    openDrawer(settingsDrawer);
    refreshStartupStatus();
    refreshVersionAndConfig();
  });

  // Poll periodically so the banner can appear even without opening Settings.
  refreshUpdateStatus();
  setInterval(refreshUpdateStatus, 5 * 60 * 1000);

  render();
});
