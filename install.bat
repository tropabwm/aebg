@echo off
echo ========================================
echo    AUTO-EDITOR INTERFACE PRO - SETUP
echo ========================================
echo.

:: Verificar se está executando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute este arquivo como Administrador!
    echo Clique com o botao direito e selecione "Executar como administrador"
    pause
    exit /b 1
)

echo [1/6] Verificando Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js 16+ de: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo ✓ Node.js encontrado
)

echo.
echo [2/6] Verificando Python...
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Python nao encontrado!
    echo Por favor, instale o Python 3.7+ de: https://python.org/
    pause
    exit /b 1
) else (
    echo ✓ Python encontrado
)

echo.
echo [3/6] Instalando auto-editor...
pip install auto-editor
if %errorLevel% neq 0 (
    echo AVISO: Erro na instalacao do auto-editor via pip
    echo Tentando com python -m pip...
    python -m pip install auto-editor
    if %errorLevel% neq 0 (
        echo ERRO: Falha na instalacao do auto-editor
        echo Tente executar manualmente: pip install auto-editor
        pause
        exit /b 1
    )
)
echo ✓ Auto-editor instalado

echo.
echo [3.5/6] Instalando dependencias do removedor de background...
call install-background-remover.bat
if %errorLevel% neq 0 (
    echo AVISO: Erro na instalacao das dependencias do background remover
    echo A funcionalidade de remocao de background pode nao funcionar
)
echo.
echo [4/6] Instalando dependencias do frontend...
call npm install
if %errorLevel% neq 0 (
    echo ERRO: Falha na instalacao das dependencias do frontend
    pause
    exit /b 1
)
echo ✓ Dependencias do frontend instaladas

echo.
echo [5/6] Instalando dependencias do backend...
cd server
call npm install
if %errorLevel% neq 0 (
    echo ERRO: Falha na instalacao das dependencias do backend
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✓ Dependencias do backend instaladas

echo.
echo [6/6] Criando diretorios necessarios...
if not exist "server\uploads" mkdir "server\uploads"
if not exist "server\uploads\processed" mkdir "server\uploads\processed"
echo ✓ Diretorios criados

echo.
echo ========================================
echo        INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo Para executar a aplicacao, use o arquivo: run.bat
echo.
echo Requisitos verificados:
echo ✓ Node.js instalado
echo ✓ Python instalado  
echo ✓ Auto-editor instalado
echo ✓ Dependencias do frontend instaladas
echo ✓ Dependencias do backend instaladas
echo ✓ Diretorios criados
echo.
pause