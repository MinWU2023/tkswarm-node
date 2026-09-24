@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title TkSwarm Rebuild

set "PORT=%TKSWARM_PORT%"
if "%PORT%"=="" set "PORT=8999"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 22+ and add it to PATH.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js 22+ and add it to PATH.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

rem Free port before start so a second click restarts cleanly.
set "KILLED="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  set "KILLED=1"
  echo Port %PORT% is busy. Stopping PID %%P ...
  taskkill /PID %%P /F >nul 2>&1
)
if defined KILLED (
  timeout /t 1 /nobreak >nul
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo Retry stopping PID %%P ...
    taskkill /PID %%P /F >nul 2>&1
  )
  timeout /t 1 /nobreak >nul
)

netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo [ERROR] Port %PORT% is still in use. Run close.bat as Administrator, then try again.
  pause
  exit /b 1
)

echo Node:
node -v
where node

echo.
echo [INFO] Data store: PHP API ^(no local MySQL^).
echo [INFO] Frontend default API: http://tkswarm-api.dyyweb.com
echo [INFO] This Node process serves UI + browser automation + WS.
echo.

:launch
echo Starting TkSwarm Rebuild on http://127.0.0.1:%PORT% ...
if /I "%TKSWARM_NO_BROWSER%"=="1" (
  echo [INFO] Skip auto-open browser ^(TKSWARM_NO_BROWSER=1^). EXE will open with loginToken.
) else (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:%PORT%"
)
call npm start
set "exitCode=%errorlevel%"

if "%exitCode%"=="0" (
  echo Server stopped.
  pause
  exit /b 0
)

echo.
echo [ERROR] Server failed to start. Exit code: %exitCode%
echo Common causes: port %PORT% still busy, missing dependencies, or API unreachable.
pause
exit /b %exitCode%
