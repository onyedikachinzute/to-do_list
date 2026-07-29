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

  // ---------- Add drawer ----------
  const fab = document.getElementById("addFab");
  const drawer = document.getElementById("addDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  const addForm = document.getElementById("addForm");

  function openDrawer() {
    drawer.hidden = false;
    backdrop.hidden = false;
    document.getElementById("taskText").focus();
  }
  function closeDrawer() {
    drawer.hidden = true;
    backdrop.hidden = true;
    addForm.reset();
  }

  fab.addEventListener("click", openDrawer);
  backdrop.addEventListener("click", closeDrawer);
  document.getElementById("cancelAdd").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) closeDrawer();
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

  render();
});
