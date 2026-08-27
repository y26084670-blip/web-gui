@echo off
setlocal

if "%~1"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Caddy.ps1" -Action InstallRootCertificate
) else if "%~2"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Caddy.ps1" -Action InstallRootCertificate -CertificatePath "%~f1"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Caddy.ps1" -Action InstallRootCertificate -CertificatePath "%~f1" -ExpectedSha256 "%~2"
)

set "EXIT_CODE=%errorlevel%"
if not defined CLARK_GUI_NO_PAUSE pause
exit /b %EXIT_CODE%
