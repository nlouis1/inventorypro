@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   InventoryPro HQ - Windows Desktop Builder
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js LTS is required to BUILD the desktop package.
  echo Install Node.js 20 or newer from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 20 or newer is required. Update Node.js and retry.
  pause
  exit /b 1
)
echo [1/4] Installing project dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto failed
echo [2/4] Validating the supplied system database...
call npm run self-check
if errorlevel 1 goto failed
echo [3/4] Building the web application...
call npm run build
if errorlevel 1 goto failed
echo [4/4] Packaging the Windows desktop folder...
call npm run desktop:package
if errorlevel 1 goto failed
echo.
echo SUCCESS. Find the app in dist\InventoryPro-HQ-Windows\
echo Copy that entire folder to a writable location, then run InventoryPro HQ.exe.
pause
exit /b 0
:failed
echo.
echo BUILD FAILED. Read the error above, check internet access, and try again.
pause
exit /b 1
