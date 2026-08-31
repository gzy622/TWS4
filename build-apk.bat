@echo off
cd /d "%~dp0"
title TWS4 - Build Release APK

where node >nul 2>&1
if errorlevel 1 goto no_node

node scripts/build-apk.js
if errorlevel 1 goto build_failed
goto end

:no_node
echo.
echo [ERROR] Node.js is not found.
echo Please install Node.js from https://nodejs.org and try again.
echo.
goto end

:build_failed
echo.
echo [ERROR] Build failed. Please check the logs above.
echo.
goto end

:end
pause
