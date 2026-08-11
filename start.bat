@echo off
title Agiler AI
color 0A

echo ============================================
echo   Agiler AI - Starting...
echo   The Autonomous AI Agent for Agile Software Delivery
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Building frontend...
call npm run build
if errorlevel 1 (
  echo Frontend build failed.
  pause
  exit /b 1
)

echo.
echo [2/2] Starting unified app on port 8000...
echo.
echo   App:  http://localhost:8000
echo   (UI + API + Jira proxy in one process)
echo ============================================
echo.

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
cd /d "%~dp0server"
py -3.12 main.py

pause
