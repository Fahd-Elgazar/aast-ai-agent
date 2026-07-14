@echo off
rem ============================================================
rem run_supervised.cmd - restart-on-exit supervisor (F3.6)
rem
rem The orchestrator deliberately exits on uncaughtException
rem (orchestrator.js) and expects a supervisor to restart it.
rem The launcher previously provided none, so a single uncaught
rem exception took the backend down for the rest of a demo.
rem
rem Usage: run_supervised.cmd <command> [args...]
rem NOTE: "call" is required - npm resolves to npm.cmd, and
rem invoking a .cmd from a .cmd without "call" transfers control
rem and never returns to this loop.
rem ============================================================
setlocal
set RESTARTS=0

:loop
call %*
set EXITCODE=%errorlevel%
set /a RESTARTS+=1
if %RESTARTS% GEQ 25 (
    echo [%date% %time%] [supervisor] restart limit reached ^(25^); giving up. Last exit code: %EXITCODE%
    exit /b 1
)
echo [%date% %time%] [supervisor] process exited with code %EXITCODE%; restart #%RESTARTS% in 3s
timeout /t 3 /nobreak >nul
goto loop
