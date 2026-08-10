@echo off
echo ========================================
echo   SafePay Frontends — Starting...
echo ========================================

echo Installing User Portal deps...
cd /d "%~dp0frontend-user"
call npm install --silent

echo Installing Agent Portal deps...
cd /d "%~dp0frontend-agent"
call npm install --silent

echo Installing Admin Portal deps...
cd /d "%~dp0frontend-admin"
call npm install --silent

echo.
echo Starting all three portals...
start "SafePay User  :3000" cmd /k "cd /d %~dp0frontend-user  && npm run dev"
start "SafePay Agent :3001" cmd /k "cd /d %~dp0frontend-agent && npm run dev"
start "SafePay Admin :3002" cmd /k "cd /d %~dp0frontend-admin && npm run dev"

echo.
echo ========================================
echo  Portals starting in separate windows:
echo  User  → http://localhost:3000
echo  Agent → http://localhost:3001
echo  Admin → http://localhost:3002
echo ========================================
pause
