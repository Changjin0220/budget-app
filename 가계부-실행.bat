@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================
echo   우리집 가계부 실행 중...
echo ================================
if not exist node_modules (
  echo 최초 실행 - 준비 중입니다 ^(1~2분 소요^)...
  call npm install
)
start "" http://localhost:5180
call npm run dev
