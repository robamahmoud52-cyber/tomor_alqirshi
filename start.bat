@echo off
chcp 65001 >nul
title Quraishi Dates - Server
cd /d "%~dp0"

echo.
echo   🌴  تمور القرشي | Quraishi Dates
echo   =============================================
echo.

rem ------- تحديد مسار Node -------
set "NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE=C:\Program Files\nodejs\node.exe"
  ) else (
    echo   [!] Node.js غير مثبت على هذا الجهاز.
    echo       نزّله من https://nodejs.org  (النسخة LTS) ثم أعد تشغيل هذا الملف.
    echo.
    pause
    exit /b 1
  )
)

rem ------- تحديد المنفذ من server\config.json -------
set "PORT=3100"
for /f "usebackq delims=" %%p in (`"%NODE%" -e "try{console.log(require('./server/config.json').port||3100)}catch(e){console.log(3100)}"`) do set "PORT=%%p"

rem ------- فتح المتصفح بعد تشغيل الخادم -------
start "" cmd /c "timeout /t 3 >nul & start http://localhost:%PORT%"

echo   ▸ الموقع        : http://localhost:%PORT%
echo   ▸ لوحة التحكم   : http://localhost:%PORT%/admin/
echo   ▸ كلمة المرور   : quraishi2026
echo.
echo   ملاحظة: لإيقاف الخادم اضغط Ctrl+C في هذه النافذة.
echo   لإيقاف رسائل الجوال: عدّل server\config.json ثم شغّل  npm run test:notify
echo.

"%NODE%" server\server.js

echo.
echo   تم إيقاف الخادم.
pause
