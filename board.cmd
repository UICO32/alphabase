@echo off
rem One-click launcher for the Alphabase project board.
rem Double-click this file, or run: board.cmd
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo [board] Python not found in PATH. Install Python 3.9+ and retry.
  pause
  exit /b 1
)
python board.py %*
if errorlevel 1 pause
