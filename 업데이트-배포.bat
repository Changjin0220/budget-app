@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================
echo   가계부 업데이트 빌드 중...
echo ================================
call npm run build
if errorlevel 1 (
  echo.
  echo [오류] 빌드 실패. 위 메시지를 확인하세요.
  pause
  exit /b 1
)
echo.
echo 빌드 완료!  아래 열린 폴더의 [dist] 를
echo Netlify 사이트에 드래그하면 배포가 갱신됩니다.
echo.
start "" "%~dp0dist"
pause
