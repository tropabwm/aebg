@echo off
echo ========================================
echo   INSTALACAO BACKGROUND REMOVER SIMPLES
echo ========================================
echo.

echo Instalando rembg (versao mais estavel)...
echo.

echo [1/2] Instalando rembg...
pip install rembg[new]

if %errorLevel% neq 0 (
    echo.
    echo Tentando com python -m pip...
    python -m pip install rembg[new]
    
    if %errorLevel% neq 0 (
        echo.
        echo ERRO: Falha na instalacao do rembg
        echo.
        echo Tente executar manualmente:
        echo pip install rembg[new]
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [2/2] Testando instalacao...
python -c "import rembg; print('✓ rembg instalado com sucesso!')"

if %errorLevel% neq 0 (
    echo AVISO: rembg pode nao estar funcionando corretamente
) else (
    echo ✓ Teste de rembg passou!
)

echo.
echo ✓ Instalacao concluida!
echo.
echo IMPORTANTE:
echo - rembg e mais estavel que BiRefNet
echo - Primeira execucao ira baixar modelos (~100MB)
echo - Funciona bem com CPU e GPU
echo.
pause