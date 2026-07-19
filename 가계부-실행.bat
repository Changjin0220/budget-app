@echo off
cd /d "%~dp0"
echo ================================
echo   Starting budget app...
echo ================================
if not exist node_modules (
  echo First run - installing packages ^(1-2 min^)...
  call npm install
)
start "" http://localhost:5180
call npm run dev
