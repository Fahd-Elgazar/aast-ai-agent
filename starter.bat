@echo off
setlocal EnableExtensions

title AAST Platform Launcher
cd /d "%~dp0"

set "COMMAND=start"
set "MODE=%~1"

if "%MODE%"=="" (
    set "MODE=demo"
) else (
    if /I "%MODE%"=="help" goto :usage
    if /I "%MODE%"=="--help" goto :usage
    if /I "%MODE%"=="-h" goto :usage
    if /I "%MODE%"=="stop" (
        set "COMMAND=stop"
        shift
        goto :parse_stop_args
    )
    if /I "%MODE%"=="shutdown" (
        set "COMMAND=stop"
        shift
        goto :parse_stop_args
    )
    if /I "%MODE%"=="status" (
        set "COMMAND=status"
        shift
        goto :parse_stop_args
    )
    if /I "%MODE%"=="demo" goto :start_mode_ok
    if /I "%MODE%"=="full" goto :start_mode_ok
    if /I "%MODE%"=="quick" goto :start_mode_ok
    echo.
    echo [ERROR] Unknown launcher mode or command: %MODE%
    goto :usage
)

:start_mode_ok
shift
set "PS_ARGS="

:parse_start_args
if "%~1"=="" goto :run_start
if /I "%~1"=="--no-pause" (
    set "PS_ARGS=%PS_ARGS% -NoPause"
) else if /I "%~1"=="--strict" (
    set "PS_ARGS=%PS_ARGS% -Strict"
) else if /I "%~1"=="--diagnostics" (
    set "PS_ARGS=%PS_ARGS% -DiagnosticsOnly"
) else if /I "%~1"=="--no-prewarm" (
    set "PS_ARGS=%PS_ARGS% -SkipPrewarm"
) else if /I "%~1"=="--no-golden-check" (
    set "PS_ARGS=%PS_ARGS% -SkipGoldenCheck"
) else if /I "%~1"=="--golden-check" (
    set "PS_ARGS=%PS_ARGS% -RunGoldenCheck"
) else if /I "%~1"=="--keep-on-failure" (
    set "PS_ARGS=%PS_ARGS% -KeepOnFailure"
) else (
    echo.
    echo [ERROR] Unknown startup option: %~1
    goto :usage
)
shift
goto :parse_start_args

:run_start
echo.
echo ====================================================
echo   AAST AI Agent Platform Launcher
echo ====================================================
echo   Mode: %MODE%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File ".\launcher\start_platform.ps1" -Mode "%MODE%" %PS_ARGS%
exit /b %ERRORLEVEL%

:parse_stop_args
set "PS_ARGS="

:parse_stop_loop
if "%~1"=="" goto :run_stop
if /I "%~1"=="--no-pause" (
    set "PS_ARGS=%PS_ARGS% -NoPause"
) else if /I "%~1"=="--include-external" (
    set "PS_ARGS=%PS_ARGS% -IncludeExternal"
) else if /I "%~1"=="--force" (
    set "PS_ARGS=%PS_ARGS% -Force"
) else (
    echo.
    echo [ERROR] Unknown shutdown/status option: %~1
    goto :usage
)
shift
goto :parse_stop_loop

:run_stop
if /I "%COMMAND%"=="status" (
    powershell -NoProfile -ExecutionPolicy Bypass -File ".\launcher\stop_platform.ps1" -StatusOnly %PS_ARGS%
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File ".\launcher\stop_platform.ps1" %PS_ARGS%
)
exit /b %ERRORLEVEL%

:usage
echo.
echo AAST launcher usage:
echo.
echo   starter.bat                 Starts demo mode
echo   starter.bat demo            Starts demo mode
echo   starter.bat full            Starts all development services
echo   starter.bat quick           Starts backend and frontend only
echo   starter.bat stop            Stops launcher-managed services
echo   starter.bat status          Shows current launcher/service status
echo.
echo Startup options:
echo   --strict             Treat optional service failures as fatal
echo   --diagnostics        Validate paths, commands, ports, and health only
echo   --no-prewarm         Skip Ollama model prewarm
echo   --no-golden-check    Skip demo golden query validation
echo   --golden-check       Force golden query validation
echo   --keep-on-failure    Keep launched services running after startup failure
echo   --no-pause           Do not wait for Enter before exit
echo.
echo Shutdown/status options:
echo   --include-external   Also stop external services launched by this launcher
echo   --force              Use forceful process-tree termination
echo   --no-pause           Do not wait for Enter before exit
echo.
exit /b 2
