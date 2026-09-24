@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title TkSwarm Rebuild - Stop

set "PORT=%TKSWARM_PORT%"
if "%PORT%"=="" set "PORT=8999"

echo Looking for TkSwarm process on port %PORT%...

set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr /I "LISTENING 侦听"') do (
  set "FOUND=1"
  echo Stopping PID %%P ...
  taskkill /PID %%P /F >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Failed to stop PID %%P. Try running this script as Administrator.
  ) else (
    echo Stopped PID %%P.
  )
)

if not defined FOUND (
  echo No listening process found on port %PORT%.
  echo Server is already stopped.
) else (
  rem Give the OS a moment to release the port
  timeout /t 1 /nobreak >nul
  netstat -ano | findstr ":%PORT% " | findstr /I "LISTENING 侦听" >nul 2>&1
  if errorlevel 1 (
    echo Done. http://127.0.0.1:%PORT% is free.
  ) else (
    echo [WARN] Port %PORT% still appears busy. Close any remaining node windows manually.
  )
)

echo.
pause
exit /b 0
