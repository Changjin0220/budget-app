@echo off
cd /d "%~dp0"
echo ================================
echo   Push to GitHub (auto deploy)
echo ================================
git add -A
git commit -m "update"
git push
echo.
echo Done. Netlify will redeploy in 1-2 min.
echo (If nothing changed, "nothing to commit" is normal.)
pause
