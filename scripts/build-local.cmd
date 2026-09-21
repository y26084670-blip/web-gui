@echo off
setlocal
chcp 65001 >nul
set "CLARK_BUILD_STARTED="
for /f %%T in ('powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Write-BuildTime.ps1" -Start') do set "CLARK_BUILD_STARTED=%%T"

cd /d "%~dp0.."

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  goto :failed
)

echo Installing clean dependencies...
call npm ci
if errorlevel 1 goto :failed

echo Building the production bundle...
call npm run build:release
if errorlevel 1 goto :failed

echo Local build completed successfully.
set "EXIT_CODE=0"
goto :finished

:failed
echo Local build failed.
set "EXIT_CODE=1"

:finished
if defined CLARK_BUILD_STARTED powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Write-BuildTime.ps1" -StartedAt "%CLARK_BUILD_STARTED%" -Label "%~nx0"
if not defined CLARK_GUI_NO_PAUSE pause
exit /b %EXIT_CODE%
