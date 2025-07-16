@echo off
echo ========================================
echo     INSTALACAO RAPIDA AUTO-EDITOR
echo ========================================
echo.

echo Instalando auto-editor...
pip install auto-editor

if %errorLevel% neq 0 (
    echo.
    echo Tentando com python -m pip...
    python -m pip install auto-editor
    
    if %errorLevel% neq 0 (
        echo.
        echo ERRO: Falha na instalacao do auto-editor
        echo.
        echo Possiveis solucoes:
        echo 1. Verifique se Python está instalado: python --version
        echo 2. Verifique se pip está instalado: pip --version
        echo 3. Tente: python -m pip install --upgrade pip
        echo 4. Tente: pip install --user auto-editor
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ✓ Auto-editor instalado com sucesso!
echo.
echo Testando instalacao...
auto-editor --help >nul 2>&1
if %errorLevel% neq 0 (
    python -m auto_editor --help >nul 2>&1
    if %errorLevel% neq 0 (
        echo AVISO: Auto-editor pode nao estar funcionando corretamente
    ) else (
        echo ✓ Auto-editor funcionando (comando: python -m auto_editor)
    )
) else (
    echo ✓ Auto-editor funcionando (comando: auto-editor)
)

echo.
pause