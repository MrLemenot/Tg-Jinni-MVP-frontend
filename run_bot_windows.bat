@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\local_polling_bridge.py
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    python scripts\local_polling_bridge.py
  ) else (
    echo Python 3 was not found. Install Python 3.11 or newer and enable Add Python to PATH.
    pause
    exit /b 1
  )
)
if errorlevel 1 pause
