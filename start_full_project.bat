@echo off
TITLE AAST Platform Launcher - Full Mode
cd /d "%~dp0"
call "%~dp0starter.bat" full %*
exit /b %ERRORLEVEL%
