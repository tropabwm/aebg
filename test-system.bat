@echo off
echo ========================================
echo      TESTE DO SISTEMA AUTO-EDITOR
echo ========================================
echo.

echo [1/5] Testando Node.js...
node --version
if %errorLevel% neq 0 (
    echo ❌ Node.js nao encontrado
    echo Instale de: https://nodejs.org/
) else (
    echo ✓ Node.js OK
)

echo.
echo [2/5] Testando Python...
python --version
if %errorLevel% neq 0 (
    echo ❌ Python nao encontrado
    echo Instale de: https://python.org/
) else (
    echo ✓ Python OK
)

echo.
echo [3/5] Testando pip...
pip --version
if %errorLevel% neq 0 (
    echo ❌ pip nao encontrado
) else (
    echo ✓ pip OK
)

echo.
echo [4/5] Testando auto-editor...
auto-editor --help >nul 2>&1
if %errorLevel% neq 0 (
    python -m auto_editor --help >nul 2>&1
    if %errorLevel% neq 0 (
        echo ❌ Auto-editor nao encontrado
        echo Execute: install-auto-editor.bat
    ) else (
        echo ✓ Auto-editor OK (python -m auto_editor)
    )
) else (
    echo ✓ Auto-editor OK
)

echo.
echo [5/5] Testando dependencias do projeto...
if exist "node_modules" (
    echo ✓ Dependencias frontend OK
) else (
    echo ❌ Dependencias frontend nao encontradas
)

if exist "server\node_modules" (
    echo ✓ Dependencias backend OK
) else (
    echo ❌ Dependencias backend nao encontradas
)

echo.
echo ========================================
echo           RESUMO DO TESTE
echo ========================================
echo.
echo Se todos os itens estao OK, execute: run.bat
echo Se algum item falhou, execute: install.bat
echo.
pause