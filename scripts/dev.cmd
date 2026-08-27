@echo off
setlocal

cd /d "%~dp0.."

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  set "EXIT_CODE=1"
  goto :finished
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm ci
  if errorlevel 1 (
    set "EXIT_CODE=1"
    goto :finished
  )
)

echo Starting the Vite development server...
call npm run dev -- --open
set "EXIT_CODE=%errorlevel%"

:finished
if not defined CLARK_GUI_NO_PAUSE pause
exit /b %EXIT_CODE%
