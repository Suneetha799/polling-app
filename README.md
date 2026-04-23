# Pollhaus — Voting / Poll App

A clean, editorial-style polling application built with **Python (Flask)** for the
backend and **vanilla HTML/CSS/JS** for the frontend. Users create polls with
2–4 options, vote once, and see live results with animated percentage bars.

---

## ✨ Features

- ✅ Create a new poll with a question and **2–4 options** (dynamic add/remove)
- ✅ Vote on a poll by selecting one option
- ✅ Results update **immediately** — animated progress bars, percentages, and vote counts
- ✅ View **all polls** in a chronological list
- ✅ **Delete** any poll
- ✅ **Prevent duplicate voting** (dual protection: server-side IP tracking + client-side `localStorage`)
- ✅ **Total vote count** shown for each poll
- ✅ Winning option is highlighted with an accent color and subtle shimmer
- ✅ Fully responsive — works on mobile, tablet, desktop
- ✅ Proper input validation and error handling on both client and server

---

## 📁 Project structure

```
polling-app/
├── backend/
│   ├── server.py          # Flask REST API
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── index.html         # Main HTML
│   ├── style.css          # Styles (editorial aesthetic)
│   └── app.js             # Frontend logic
└── README.md
```

---

## 🚀 Setup & run

### Prerequisites
- Python **3.8** or higher
- `pip` (comes with Python)

### Step 1 — Install dependencies

Open a terminal in the project root and run:

```bash
cd backend
pip install -r requirements.txt
```

> On some systems you may need `pip3` instead of `pip`, or add `--user` if you
> are installing without a virtual environment.

*(Optional but recommended — use a virtual environment)*
```bash
python -m venv venv
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2 — Run the server

From inside the `backend/` directory:

```bash
python server.py
```

You should see:
```
============================================================
  Voting/Poll App — Backend running at http://localhost:5000
============================================================
```

### Step 3 — Open the app

Open your browser and go to:

**http://localhost:5000**

The Flask server serves the frontend automatically, so you don't need a
separate web server for the static files.

---

## 🔌 API reference

| Method  | Endpoint                 | Description                    | Request body                    | Response                                 |
| ------- | ------------------------ | ------------------------------ | ------------------------------- | ---------------------------------------- |
| `GET`   | `/polls`                 | Get all polls                  | —                               | Array of polls (with votes & %)          |
| `POST`  | `/polls`                 | Create a poll                  | `{ question, options: [] }`     | Created poll                             |
| `POST`  | `/polls/:id/vote`        | Vote on a poll                 | `{ optionIndex }`               | Updated poll with results                |
| `DELETE`| `/polls/:id`             | Delete a poll                  | —                               | `{ message, id }`                        |
| `GET`   | `/polls/:id/results`     | Get results for a single poll  | —                               | `{ question, results, totalVotes }`      |

### Response shape (for a poll)
```json
{
  "id": "b5e3f0b0-...",
  "question": "What's for dinner?",
  "options": [
    { "text": "Pizza",  "votes": 5, "percentage": 62.5 },
    { "text": "Sushi",  "votes": 3, "percentage": 37.5 }
  ],
  "totalVotes": 8,
  "createdAt": "2026-04-22T12:30:00Z"
}
```

### Error responses
All errors return JSON like `{ "error": "message" }` with an appropriate HTTP status:
- `400` — bad input (missing question, < 2 options, > 4 options, invalid index, etc.)
- `404` — poll not found
- `409` — already voted from this IP

---

## 🧠 Implementation notes

### In-memory database
As specified in the assignment, data is stored in a Python dict in memory — no
persistence. Shape:
```python
db = {"polls": []}
# Each poll:
# {
#   "id": str (uuid),
#   "question": str,
#   "options": [{"text": str, "votes": int}],
#   "createdAt": str (ISO),
#   "voters": set[str]  # IPs that have voted
# }
```

> Restarting the server clears all polls — this is intentional per the brief.

### Duplicate-vote prevention
Two independent layers:
1. **Server-side (authoritative)** — each poll tracks a `set` of IPs that have
   voted. A second vote from the same IP returns `409 Conflict`.
2. **Client-side** — `localStorage` remembers which polls this browser has
   voted on, so the UI instantly switches to results view and hides the vote
   buttons. This also makes the experience feel snappy on repeat visits.

### Percentage math
Percentages are computed server-side as `(votes / totalVotes) * 100` with
guard for zero totals, rounded to 1 decimal place. The client does not
recompute — it just renders whatever the server returns, keeping math in one
place.

### Validation
- Question: required, ≤ 200 chars
- Options: 2–4 required, each ≤ 100 chars, no duplicates (case-insensitive)
- `optionIndex`: must be an integer within range
- Whitespace is trimmed; empty options are ignored

---

## 🎨 Design

The UI uses an **editorial / print-inspired** aesthetic — warm cream paper,
serif display type (Fraunces), persimmon accent, and animated result bars with
a subtle shimmer on the winning option. Typography pairs a characterful
italic serif with a monospace secondary font for labels and metadata.

---

## 🛠 Tech stack

- **Backend:** Python 3, Flask, Flask-CORS
- **Frontend:** HTML5, CSS3 (custom properties, grid, flexbox), vanilla JS (ES6+)
- **Fonts:** Fraunces, Inter, JetBrains Mono (Google Fonts)
- **Storage:** In-memory Python dict + browser `localStorage` for client voted-state

---

## 📝 License

MIT — free to use, modify, and share.
