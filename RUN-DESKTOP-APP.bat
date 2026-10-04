@echo off
setlocal
cd /d "%~dp0"
if exist "dist\InventoryPro-HQ-Windows\InventoryPro HQ.exe" (
  start "" "dist\InventoryPro-HQ-Windows\InventoryPro HQ.exe"
) else (
  echo Desktop app not built yet. Run BUILD-WINDOWS.bat first.
  pause
)
