@echo off
TITLE AAST Platform Shutdown
cd /d "%~dp0"
echo Shutting down AAST AI Agent Platform...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\launcher\stop_platform.ps1"
