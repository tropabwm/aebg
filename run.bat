@echo off
echo ========================================
echo    AUTO-EDITOR INTERFACE PRO - START
echo ========================================
echo.

:: Verificar se as dependências estão instaladas
if not exist "node_modules" (
    echo ERRO: Dependencias nao encontradas!
    echo Execute install.bat primeiro
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo ERRO: Dependencias do servidor nao encontradas!
    echo Execute install.bat primeiro
    pause
    exit /b 1
)

:: Verificar se auto-editor está instalado
echo [1/4] Verificando auto-editor...
auto-editor --help >nul 2>&1
if %errorLevel% neq 0 (
    python -m auto_editor --help >nul 2>&1
    if %errorLevel% neq 0 (
        echo ERRO: Auto-editor nao encontrado!
        echo Execute install.bat primeiro
        pause
        exit /b 1
    ) else (
        echo ✓ Auto-editor encontrado (python -m auto_editor)
    )
) else (
    echo ✓ Auto-editor encontrado
)

:: Finalizar processos existentes na porta 3001 (backend)
echo.
echo [2/4] Finalizando processos existentes...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    echo Finalizando processo na porta 3001 (PID: %%a)
    taskkill /f /pid %%a >nul 2>&1
)

:: Finalizar processos existentes na porta 3000 (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Finalizando processo na porta 3000 (PID: %%a)
    taskkill /f /pid %%a >nul 2>&1
)

echo ✓ Processos finalizados

:: Iniciar o servidor backend
echo.
echo [3/4] Iniciando servidor backend...
cd server
start "Auto-Editor Backend" cmd /k "echo Backend rodando na porta 3001 && npm start"
cd ..

:: Aguardar o backend inicializar
echo Aguardando backend inicializar...
timeout /t 3 /nobreak >nul

:: Verificar se o backend está rodando
echo Verificando se backend está ativo...
curl -s http://127.0.0.1:3001/api/health >nul 2>&1
if %errorLevel% neq 0 (
    echo AVISO: Backend pode estar demorando para inicializar
    echo Se houver problemas, verifique a janela do backend
)

:: Iniciar o frontend
echo.
echo [4/4] Iniciando interface web...
start "Auto-Editor Frontend" cmd /k "echo Frontend rodando na porta 3000 && npm run dev:host"

:: Aguardar frontend inicializar
echo Aguardando frontend inicializar...
timeout /t 5 /nobreak >nul

:: Abrir navegador
echo.
echo ========================================
echo      APLICACAO INICIADA COM SUCESSO!
echo ========================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo.
echo Abrindo navegador...
start http://localhost:3000

echo.
echo INSTRUCOES:
echo - A aplicacao está rodando em duas janelas separadas
echo - Frontend (Interface): http://localhost:3000  
echo - Backend (API): http://localhost:3001
echo - Para parar, feche ambas as janelas ou use Ctrl+C
echo - Para reiniciar, execute este arquivo novamente
echo.
echo Pressione qualquer tecla para minimizar esta janela...
pause >nul

:: Minimizar a janela atual
powershell -command "(New-Object -ComObject Shell.Application).MinimizeAll()"