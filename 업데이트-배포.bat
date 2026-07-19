@echo off
cd /d "%~dp0"
echo ================================
echo   Building for deploy...
echo ================================
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. Check messages above.
  pause
  exit /b 1
)
echo.
echo Build done. Drag the [dist] folder into Netlify.
start "" "%~dp0dist"
pause
