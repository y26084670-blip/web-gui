@echo off
setlocal

set "CALLER_NO_PAUSE=%CLARK_GUI_NO_PAUSE%"
set "CLARK_GUI_NO_PAUSE=1"

echo Building the release bundle...
call "%~dp0build-local.cmd"
if errorlevel 1 goto :failed

if not exist "%~dp0..\deploy\caddy\settings.local.json" (
  echo Caddy LAN settings are not configured yet.
  call "%~dp0caddy\configure.cmd"
  if errorlevel 1 goto :failed
)

call "%~dp0caddy\start.cmd"
if errorlevel 1 goto :failed

set "EXIT_CODE=0"
goto :finished

:failed
set "EXIT_CODE=1"

:finished
if not defined CALLER_NO_PAUSE pause
exit /b %EXIT_CODE%
