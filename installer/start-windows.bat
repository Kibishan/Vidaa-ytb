@echo off
SET SCRIPT_DIR=%~dp0
SET ROOT_DIR=%SCRIPT_DIR%..

where node >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
  IF EXIST "%ROOT_DIR%\scripts\serve-vidaa.mjs" (
    cd /d "%ROOT_DIR%"
    node scripts\serve-vidaa.mjs
    goto :eof
  )
)

python "%SCRIPT_DIR%server.py"
pause
