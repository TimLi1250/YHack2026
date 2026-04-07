# YHack2026

YHack2026 is a full-stack civic information app with:

- a FastAPI backend in `backend/`
- a React + Vite frontend in `frontend/`

## Prerequisites

- Conda or Miniconda
- Node.js 18+ and npm

## 1. Create and activate the Conda environment

From the repo root:

```bash
conda create -n yhack2026 python=3.11 -y
conda activate yhack2026
```

## 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

## 3. Optional backend environment variables

Create a `backend/.env` file if you want live API-backed data or LLM features:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-pro
GOOGLE_CIVIC_API_KEY=your_key_here
GEOCODE_API_KEY=your_key_here
CONGRESS_API_KEY=your_key_here
LLM_TIMEOUT_SECONDS=60
```

Notes:

- Without API keys, the backend can still use cached JSON data in `backend/app/data/`.
- The backend reads these variables automatically with `python-dotenv`.

## 4. Run the backend

In one terminal:

```bash
conda activate yhack2026
cd backend
uvicorn app.main:app --reload
```

Backend URLs:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

## 5. Install frontend dependencies

Open a second terminal and run:

```bash
cd frontend
npm install
```

## 6. Run the frontend

In that second terminal:

```bash
cd frontend
npm run dev
```

The frontend will usually start at:

```text
http://localhost:5173
```

The Vite dev server is already configured to proxy API requests to `http://127.0.0.1:8000`, so the backend should be running at the same time.

## Full local startup

Terminal 1:

```bash
conda activate yhack2026
cd backend
uvicorn app.main:app --reload
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Project structure

```text
YHack2026/
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── backend_README.MD
├── frontend/
│   ├── src/
│   ├── package.json
│   └── frontend_README.md
└── README.md
```
