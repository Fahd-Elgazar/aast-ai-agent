@echo off
TITLE AAST Platform Launcher
cd /d "%~dp0"
echo Launching AAST AI Agent Platform...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\launcher\start_platform.ps1"
