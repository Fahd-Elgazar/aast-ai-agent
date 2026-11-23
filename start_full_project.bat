@echo off
TITLE AAST Platform Launcher - Full Mode
cd /d "%~dp0"
if /I "%~1"=="--docker" (
    call "%~dp0starter.bat" docker "%~2"
) else (
    call "%~dp0starter.bat" full %*
)
exit /b %ERRORLEVEL%
