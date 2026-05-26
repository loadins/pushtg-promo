@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   PUSHTG — promo site                    ║
echo  ║   http://localhost:8090                  ║
echo  ╚══════════════════════════════════════════╝
echo.

start "" http://localhost:8099

python -m http.server 8099
