@echo off
title Astraeus Portfolio Prediction Suite
echo ====================================================================
echo                 ASTRAEUS PORTFOLIO INTELLIGENCE CLIENT
echo ====================================================================
echo.

:: 1. Activate Virtual Environment
if exist .venv\Scripts\activate (
    echo [System] Found virtual environment in .venv. Activating...
    call .venv\Scripts\activate
) else if exist venv\Scripts\activate (
    echo [System] Found virtual environment in venv. Activating...
    call venv\Scripts\activate
) else (
    echo [Warning] No virtual environment detected in .venv or venv. Using global Python.
)

:: 2. Start Python FastAPI Backend Service
echo [Backend] Launching Python FastAPI Ensemble predicting module in the background...
start "Astraeus Backend Server" python -m uvicorn api.main:app --port 8000 --reload

:: Wait for FastAPI backend initialization (3 seconds)
echo [System] Synchronizing backend startup (3s)...
timeout /t 3 /nobreak > nul

:: 3. Start Frontend Dashboard dev server
echo [Frontend] Starting React user dashboard interface...
cd frontend
start "Astraeus Frontend Dashboard" npm run dev

:: Wait for Vite dev server initialization (3 seconds)
echo [System] Synchronizing frontend startup (3s)...
timeout /t 3 /nobreak > nul

:: 4. Direct Browser Target
echo [Browser] Directing browser to Client Interface page...
start http://localhost:5173

:: 5. Launch PyScheduler Daemon in foreground
echo [System] Re-establishing root folder focus and initializing Scheduler daemon...
cd ..
echo [Scheduler] Initializing Daily Pipeline (Running at 16:00 IST / 4:00 PM)...
python scheduler.py
