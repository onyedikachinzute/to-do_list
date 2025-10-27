document.addEventListener("DOMContentLoaded", () => {
  // --- Footer year ---
  const year = document.getElementById("yr");
  if (year) year.textContent = new Date().getFullYear();

  // --- Theme toggle ---
  const toggle = document.getElementById("theme-toggle");
  const body = document.body;
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "light") {
    body.classList.add("light");
    toggle.textContent = "🌞";
  }

  toggle.addEventListener("click", () => {
    body.classList.add("theme-switching");
    body.classList.toggle("light");
    const isLight = body.classList.contains("light");
    toggle.textContent = isLight ? "🌞" : "🌙";
    localStorage.setItem("theme", isLight ? "light" : "dark");

    setTimeout(() => body.classList.remove("theme-switching"), 500);
  });

  // --- Fade-in animation for all tasks ---
  const tasks = document.querySelectorAll(".tasks li");
  tasks.forEach((task, i) => {
    task.classList.add("task-enter");
    task.style.animationDelay = `${i * 0.05}s`;
  });

  // --- Handle DELETE with fade-out ---
  const deleteForms = document.querySelectorAll("form[action^='/delete/']");
  deleteForms.forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const li = form.closest("li");
      li.classList.add("task-exit");
      li.addEventListener("animationend", () => form.submit());
    });
  });

  // --- Handle TOGGLE without full reload ---
  const toggleForms = document.querySelectorAll("form[action^='/toggle/']");
  toggleForms.forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const li = form.closest("li");

      try {
        const res = await fetch(form.action, { method: "POST" });
        if (!res.ok) throw new Error("Toggle failed");

        li.classList.toggle("done");

        // Animate instantly when toggled
        li.classList.add("pulse");
        setTimeout(() => li.classList.remove("pulse"), 400);

        const btn = form.querySelector(".toggle-btn");
        const isDone = li.classList.contains("done");
        btn.textContent = isDone ? "✅" : "⬜";
      } catch (err) {
        console.error("Error toggling task:", err);
      }
    });
  });
});
