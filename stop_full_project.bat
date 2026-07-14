@echo off
TITLE AAST Platform Shutdown
cd /d "%~dp0"
call "%~dp0starter.bat" stop %*
exit /b %ERRORLEVEL%
