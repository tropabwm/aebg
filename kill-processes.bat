@echo off
echo ========================================
echo   FINALIZANDO PROCESSOS AUTO-EDITOR
echo ========================================
echo.

echo Finalizando processos Node.js na porta 3000 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Finalizando PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo Finalizando processos Node.js na porta 3001 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    echo Finalizando PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Finalizando todos os processos Node.js relacionados...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1

echo.
echo ✓ Todos os processos foram finalizados
echo.
pause