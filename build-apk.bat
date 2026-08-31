@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title TWS4 - Build Release APK

set "EXIT_CODE=0"
set "APK_PATH=%~dp0android\app\build\outputs\apk\release\app-release.apk"
set "APK_SIZE="

where.exe node >nul 2>&1
if errorlevel 1 goto no_node
if not exist "%~dp0scripts\build-apk.js" goto no_driver

node "%~dp0scripts\build-apk.js"
set "EXIT_CODE=%ERRORLEVEL%"
if errorlevel 1 goto build_failed
if not exist "%APK_PATH%" goto artifact_missing
for %%I in ("%APK_PATH%") do set "APK_SIZE=%%~zI"
if "%APK_SIZE%"=="0" goto artifact_empty
goto build_succeeded

:no_node
set "EXIT_CODE=9009"
echo.
echo [ERROR] Node.js is not found.
echo Please install Node.js from https://nodejs.org and try again.
goto end

:no_driver
set "EXIT_CODE=2"
echo.
echo [ERROR] The build driver is missing: scripts/build-apk.js
goto end

:build_failed
echo.
echo [ERROR] Build failed with exit code %EXIT_CODE%.
goto end

:artifact_missing
set "EXIT_CODE=3"
echo.
echo [ERROR] The APK was not generated at the expected path.
echo %APK_PATH%
goto end

:artifact_empty
set "EXIT_CODE=4"
echo.
echo [ERROR] The generated APK is empty.
echo %APK_PATH%
goto end

:build_succeeded
set "EXIT_CODE=0"
echo.
echo [SUCCESS] Release APK verified.
echo APK: %APK_PATH%
echo Size: %APK_SIZE% bytes
echo.

:end
echo.
pause
exit /b %EXIT_CODE%
