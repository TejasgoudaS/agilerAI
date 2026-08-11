@echo off
title AI Agile Story Generator - Launcher
color 0A

echo ============================================
echo   AI Agile Story Generator - Starting...
echo ============================================
echo.

:: Start the Python Agent Backend
echo [1/2] Starting CrewAI Agent Backend (port 8000)...
start "Agent Backend" cmd /k "cd /d %~dp0server && python main.py"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: Start the Vite Frontend
echo [2/2] Starting Vite Frontend (port 5173)...
start "Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ============================================
echo   Both servers are starting!
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo ============================================
echo.
echo You can close this window. The servers run in their own terminals.
pause
