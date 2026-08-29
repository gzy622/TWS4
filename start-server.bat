@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title 局域网预览服务器 - TWS4

echo ========================================================
echo               正在启动局域网预览服务器...
echo ========================================================
echo.

if not defined HOST set "HOST=0.0.0.0"
if not defined PORT set "PORT=8080"

where node >nul 2>&1
if not errorlevel 1 (
    echo [提示] 服务将监听所有网络接口，端口 %PORT%。
    echo [提示] 首次启动时，请允许 Node.js 通过 Windows 防火墙。
    echo [提示] 按 Ctrl+C 可停止服务。
    echo.
    node server.js
    goto after_run
)

where python >nul 2>&1
if not errorlevel 1 (
    echo [提示] 未检测到 Node.js，改用 Python 启动服务。
    echo [提示] 服务将监听所有网络接口，端口 %PORT%。
    echo [提示] 请使用本机局域网 IP 和端口 %PORT% 访问。
    echo [提示] 按 Ctrl+C 可停止服务。
    echo.
    python -m http.server %PORT% --bind %HOST%
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
