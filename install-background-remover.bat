@echo off
echo ========================================
echo   INSTALACAO BACKGROUND REMOVER DEPS
echo ========================================
echo.

echo Instalando dependencias do removedor de background...
echo.

echo [1/3] Instalando PyTorch...
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

if %errorLevel% neq 0 (
    echo.
    echo Tentando instalacao CPU do PyTorch...
    pip install torch torchvision torchaudio
)

echo.
echo [2/3] Instalando Transformers e HuggingFace Hub...
pip install transformers>=4.39.1 huggingface_hub accelerate

echo.
echo [3/3] Instalando outras dependencias...
pip install moviepy pillow opencv-python numpy timm kornia scikit-image einops

if %errorLevel% neq 0 (
    echo.
    echo ERRO: Falha na instalacao das dependencias
    echo.
    echo Tente executar manualmente:
    echo pip install torch transformers moviepy pillow opencv-python numpy
    echo.
    pause
    exit /b 1
)

echo.
echo ✓ Dependencias do removedor de background instaladas!
echo.
echo Testando instalacao...
python -c "import torch, transformers, moviepy; print('✓ Todas as dependencias OK')"

if %errorLevel% neq 0 (
    echo AVISO: Algumas dependencias podem nao estar funcionando
) else (
    echo ✓ Teste de dependencias passou!
)

echo.
echo IMPORTANTE:
echo - Para usar GPU (recomendado): Instale CUDA 11.8+
echo - Para usar apenas CPU: Funciona mas sera mais lento
echo - Primeira execucao ira baixar modelos (~2GB)
echo.
pause