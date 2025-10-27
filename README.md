# ✅ Kachi’s To-Do List

A minimalist, responsive **To-Do List App** built with **Flask**, **HTML**, **CSS**, and **JavaScript**.  
It allows users to add, complete, and delete tasks with smooth animations, dark/light themes, and local JSON storage — all running locally with Flask’s backend.

![Screenshot](static/preview.png)

---

## 🌟 Features

- 🧩 **Add, mark, and delete tasks**
- 💾 **Data persistence** via a lightweight JSON file (no database setup needed)
- 🌙 **Dark / Light mode toggle** with saved preference using `localStorage`
- ⚡ **Smooth micro-animations** for task addition, deletion, and toggle
- 📱 **Fully responsive** — works beautifully on desktop and mobile
- 🎨 **Simple, clean UI** inspired by modern productivity tools

---

## 🧰 Tech Stack

| Component | Technology |
|------------|-------------|
| **Backend** | Python (Flask) |
| **Frontend** | HTML5, CSS3, JavaScript |
| **Data Storage** | Local JSON file (`tasks.json`) |
| **Icons** | Emoji & Favicon |
| **Version Control** | Git + GitHub |

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/onyedikachinzute/to-do_list.git
cd to-do_list
```

### 2️⃣ Install Dependencies
Make sure you have Python 3.x installed, then:
```bash
pip install flask
```

### 3️⃣ Run the Application
```bash
python app.py
```
Then open your browser and visit:
```
http://127.0.0.1:5000/
```

---

## 🧩 Project Structure
```
to-do_list/
├── app.py                 # Flask server
├── tasks.json             # JSON database for tasks
├── templates/
│   └── index.html         # Frontend template
├── static/
│   ├── style.css          # Styling
│   ├── script.js          # Frontend logic
│   └── todo_icon.png      # Favicon
└── README.md
```

---

## 🎨 Preview

| Mode | Screenshot |
|------|-------------|
| 🌙 Dark Mode | ![Dark](static/dark_preview.png) |
| 🌞 Light Mode | ![Light](static/light_preview.png) |

---

## ⚙️ How It Works

- When a task is **added**, it’s stored in `tasks.json`.
- When toggled ✅ / ⬜, it updates the `done` status via an AJAX POST call to Flask.
- When deleted 🗑, it fades out and is removed from the JSON file.
- The theme preference is saved in `localStorage` so it remembers your last mode.

---

## 💡 Future Improvements
- [ ] Add task editing
- [ ] Add categories or filters (e.g., work, personal)
- [ ] Add due dates and reminders
- [ ] Deploy on Render or Railway
- [ ] Connect to a real database (SQLite / PostgreSQL)

---

## 🧑‍💻 Author

**Onyedikachi Nzute**  
*Computer Science Student | Software & Web Developer*  

---

## 🪪 License
This project is open-source under the **MIT License** — feel free to use and modify it.

---

⭐ If you like this project, give it a star on GitHub!
