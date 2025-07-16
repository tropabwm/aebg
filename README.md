# Auto-Editor Interface Pro

Uma interface moderna e profissional para o auto-editor, permitindo processamento de vídeos com remoção automática de silêncios, geração de legendas sincronizadas e exportação em múltiplos formatos.

## Recursos

- **Interface Moderna**: Design responsivo com tema escuro profissional
- **Dois Players Sincronizados**: Visualização do vídeo original e processado lado a lado
- **Configurações Avançadas**: Controle completo sobre parâmetros de processamento
- **Legendas Automáticas**: Geração e sincronização de legendas com o vídeo processado
- **Exportação Múltipla**: Suporte a MP4, MOV, AVI, MKV
- **Exportação de Legendas**: Geração de arquivos .srt
- **Processamento em Tempo Real**: Monitoramento do progresso de processamento

## Instalação

1. Execute o arquivo `install.bat` como administrador
2. Aguarde a instalação de todas as dependências
3. Execute o arquivo `run.bat` para iniciar a aplicação

## Pré-requisitos

- Node.js (versão 16 ou superior)
- Python (versão 3.7 ou superior)
- FFmpeg (incluído com auto-editor)

## Uso

1. Execute `run.bat`
2. Acesse http://localhost:3000
3. Carregue um vídeo usando o botão "Carregar Vídeo"
4. Ajuste as configurações conforme necessário
5. Clique em "Processar Vídeo"
6. Visualize o resultado nos players sincronizados
7. Exporte o vídeo processado e/ou legendas

## Configurações Disponíveis

- **Limite de Silêncio**: Sensibilidade para detecção de silêncios
- **Margem de Quadros**: Frames a manter antes/depois dos cortes
- **Qualidade do Vídeo**: Controle de compressão (CRF)
- **Resolução**: Redimensionamento do vídeo
- **Codec de Vídeo**: H.264, H.265, VP9
- **Formato de Exportação**: MP4, MOV, AVI, MKV

## Arquitetura

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express
- **Processamento**: Python auto-editor
- **Servidor de Desenvolvimento**: Vite

## Estrutura de Pastas

```
auto-editor-interface/
├── src/                    # Código fonte do frontend
├── server/                 # Código fonte do backend
├── install.bat            # Script de instalação
├── run.bat               # Script de execução
└── README.md             # Documentação
```

## Suporte

Para problemas ou dúvidas:
1. Verifique se todos os pré-requisitos estão instalados
2. Execute `install.bat` novamente se houver problemas
3. Consulte os logs do console para detalhes de erros

## Licença

Este projeto é licenciado sob a MIT License.