@echo off
setlocal
set SCRIPT=%~dp0sync.js
if not exist "%SCRIPT%" (
  echo [ERROR] sync.js not found in "%~dp0"
  exit /b 1
)
node "%SCRIPT%" %*
endlocal