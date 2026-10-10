# Creative Block Predictor

An AI-powered dashboard that predicts your risk of a creative block based on
daily habits (sleep, stress, mood, workload, etc.) using a Random Forest
model, and gives you personalized recovery suggestions.

This build uses a **local SQLite database** and simple email/password login
(JWT tokens) — no Firebase setup required. Everything runs on your machine.

---

## Project Structure

```
creative-block-predictor/
├── backend/           FastAPI + ML (Python)
│   ├── ml/
│   │   ├── train_model.py     <- trains the RandomForest model
│   │   ├── model.pkl          <- already trained, ready to use
│   │   ├── encoders.pkl
│   │   └── feature_cols.pkl
│   ├── services/
│   │   └── ml_service.py      <- turns predictions into risk + reasons + suggestions
│   ├── main.py                <- FastAPI app & all API routes
│   ├── database.py            <- SQLite models (Users, CheckIns)
│   ├── auth_utils.py          <- JWT auth + password hashing
│   ├── schemas.py             <- request/response validation
│   └── requirements.txt
│
└── frontend/           React + Vite + Tailwind
    └── src/
        ├── api/client.js          <- axios instance, attaches auth token
        ├── context/                <- Auth + Dark Mode state
        ├── components/             <- Sidebar, Layout, form inputs, badges
        └── pages/                  <- Login, Register, Dashboard, History,
                                        Analytics, Reports, Settings
```

---

## Prerequisites

Install these once if you don't already have them:

1. **VS Code** — https://code.visualstudio.com/
2. **Python 3.10+** — https://www.python.org/downloads/ (check "Add to PATH" during install)
3. **Node.js 18+** — https://nodejs.org/ (LTS version)

Verify installs by opening a terminal and running:
```bash
python --version
node --version
npm --version
```

---

## Step 1 — Open the project in VS Code

Unzip the project, then in VS Code: **File → Open Folder** → select the
`creative-block-predictor` folder.

Open a terminal in VS Code: **Terminal → New Terminal**.

---

## Step 2 — Set up and run the Backend

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Enable the AI Chatbot Assistant (optional but recommended)

The app includes a floating AI chat widget that answers questions about
your own check-in data (e.g. "Why am I always tired on Mondays?"), powered
by Google Gemini's free tier.

1. Get a free API key at **https://aistudio.google.com/apikey** (sign in
   with a Google account, click "Create API Key").
2. In the `backend` folder, copy `.env.example` to a new file named `.env`:
   ```bash
   # Windows:
   copy .env.example .env
   # Mac/Linux:
   cp .env.example .env
   ```
3. Open `.env` in VS Code and paste your key:
   ```
   GEMINI_API_KEY=your_actual_key_here
   ```
4. Save the file.

If you skip this, the app still runs fine — the chat widget will just
reply that it isn't configured yet, instead of an AI answer.

### Run the backend

```bash
uvicorn main:app --reload --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`.

Open **http://localhost:8000/docs** in your browser — this is the
interactive API documentation (Swagger UI). You can test every endpoint
here directly, which is great for verifying things work before touching
the frontend.

> The ML model is already trained and included (`model.pkl`). If you ever
> want to retrain it (e.g. after changing the dataset logic), run:
> `python ml/train_model.py` from inside the `backend` folder.

**Keep this terminal running.** Open a **second terminal** for the frontend
(Terminal → Split Terminal, or Terminal → New Terminal).

---

## Step 3 — Set up and run the Frontend

```bash
cd frontend
npm install
npm run dev
```

You should see something like `Local: http://localhost:5173/`.

Open **http://localhost:5173** in your browser. You should see the login
screen.

---

## Step 4 — Use the app

1. Click **"Create one"** to register a new account (just stored locally in
   `backend/app.db`, a SQLite file — no cloud setup needed).
2. You'll land on the **Dashboard**. Fill in the sliders/dropdowns and click
   **Analyze My Risk**.
3. Check out **History** (with search, filter, CSV/PDF export), **Analytics**
   (trend charts), **Reports** (weekly/monthly/yearly + PDF), and **Settings**
   (profile + dark mode).

Both servers need to stay running while you use the app:
- Backend on port 8000
- Frontend on port 5173

---

## How the ML model works

`backend/ml/train_model.py` generates a synthetic but logically consistent
dataset (sleep, stress, workload, etc. → risk label), trains a
`RandomForestClassifier`, and saves it. At prediction time,
`backend/services/ml_service.py`:
1. Encodes your inputs the same way the training data was encoded
2. Runs the model to get a risk level + confidence score
3. Builds a plain-English reason by checking which of your metrics are in
   an unhealthy range
4. Picks recovery suggestions from a rules-based list matched to your
   specific weak spots

If you want to improve prediction quality later, the most impactful change
would be replacing the synthetic dataset with real logged data over time —
the more real check-ins in the database, the more you could enrich or
retrain the model.

---

## Common issues

**"npm: command not found" or "python: command not found"**
Node.js or Python isn't installed or isn't on your PATH — reinstall and
restart VS Code.

**Frontend loads but API calls fail / network error**
Make sure the backend terminal is still running and shows no errors.
Check http://localhost:8000/docs loads in your browser.

**"Port already in use"**
Something else is using port 8000 or 5173. Stop the other process, or run
the backend with `--port 8001` (and update `API_BASE_URL` in
`frontend/src/api/client.js` to match) or frontend with `npm run dev -- --port 5174`.

**CORS errors in the browser console**
The backend only allows requests from `http://localhost:5173` by default
(see the `CORSMiddleware` config in `backend/main.py`). If you run the
frontend on a different port, add that origin there too.

---

## Next steps you could add later

- Swap SQLite for Firebase Firestore + Firebase Auth (the original spec) —
  the API route logic stays largely the same, just swap out `database.py`
  and `auth_utils.py`.
- Deploy the backend (Render, Railway, Fly.io) and frontend (Vercel,
  Netlify) so it's accessible outside your machine.
- Add more features to the ML model as you collect real usage data.
