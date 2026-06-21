@echo off
chcp 65001 > nul
echo =================================================================
echo             Starting PRISM Locally (Unified Process)
echo =================================================================
echo.

REM Verify node_modules
if not exist "node_modules" (
  echo ERROR: "node_modules" folder not found! Please run setup-local.bat first.
  pause
  exit /b 1
)

REM Verify .env
if not exist ".env" (
  echo ERROR: ".env" file is missing! Please run setup-local.bat or copy .env.example.
  pause
  exit /b 1
)

echo Starting full-stack development server (Express + Vite Middleware)...
echo App will be serve-active on: http://localhost:3000
echo.

REM Wait 2 seconds before launching browser link
timeout /t 2 >nul
start http://localhost:3000

REM Run the consolidated full-stack dev command
call npm run dev

pause
