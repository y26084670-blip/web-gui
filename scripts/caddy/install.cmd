@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Caddy.ps1" -Action Install
set "EXIT_CODE=%errorlevel%"
if not defined CLARK_GUI_NO_PAUSE pause
exit /b %EXIT_CODE%
