@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
start "TkSwarm Rebuild" http://127.0.0.1:8400
npm start
