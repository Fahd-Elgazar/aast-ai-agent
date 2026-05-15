@echo off
TITLE AAST Platform Launcher
cd /d "%~dp0"
echo Launching AAST AI Agent Platform...
echo PowerShell launcher will start Ollama first, wait for /api/tags, then start the backend.
powershell -NoProfile -ExecutionPolicy Bypass -File ".\launcher\start_platform.ps1"
