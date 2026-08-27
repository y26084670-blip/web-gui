@echo off
setlocal

cd /d "%~dp0.."

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  goto :failed
)

echo Installing clean dependencies...
call npm ci
if errorlevel 1 goto :failed

echo Running local tests...
call npm test
if errorlevel 1 goto :failed

echo Building the production bundle...
call npm run build:release
if errorlevel 1 goto :failed

echo Local verification completed successfully.
set "EXIT_CODE=0"
goto :finished

:failed
echo Local verification failed.
set "EXIT_CODE=1"

:finished
if not defined CLARK_GUI_NO_PAUSE pause
exit /b %EXIT_CODE%
