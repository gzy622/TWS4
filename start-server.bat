@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title 局域网预览服务器 - TWS4

echo ========================================================
echo               正在启动局域网预览服务器...
echo ========================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    node server.js
    goto after_run
)

where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [提示] 未检测到 Node.js，正在通过 Python 启动服务 (8080端口)...
    python -m http.server 8080 --bind 0.0.0.0
    goto after_run
)

echo [错误] 未检测到 Node.js 或 Python 环境。
echo 请安装 Node.js (https://nodejs.org) 后重试。

:after_run
echo.
echo ========================================================
echo [提示] 服务进程已结束。
echo ========================================================
pause
