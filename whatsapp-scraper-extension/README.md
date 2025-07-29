# WhatsApp Group Scraper Extension (Versão Simplificada)

Extensão do Chrome/Chromium para extrair membros de grupos do WhatsApp Web com interface simplificada.

## O que mudou?

Agora a extensão tem apenas **um botão simples** que você clica para carregar o scraper, similar ao design do localhost:3456.

## Instalação

1. Abra **chrome://extensions/** no Chrome/Chromium
2. Ative o **"Modo do desenvolvedor"** (canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta **whatsapp-scraper-extension**

## Como Usar

1. Acesse https://web.whatsapp.com
2. Faça login com QR code
3. Aparecerá um botão no centro da tela: **"Carregar WhatsApp Scraper"**
4. Clique no botão para ativar o scraper
5. O botão desaparece e a interface do scraper aparece no canto superior direito
6. Abra um grupo e clique no nome para ver membros
7. Role a lista - os dados são coletados automaticamente
8. Clique em **"Download"** para exportar CSV

## Interface Simplificada

- **Antes**: Scraper carregava automaticamente
- **Agora**: Você clica em um botão para carregar quando quiser

## Verificar se Está Funcionando

No console (F12), procure por:
- ⚡ WhatsApp Scraper: Injetando botão...
- ✅ WhatsApp Scraper: Botão injetado com sucesso!
- 🚀 WhatsApp Scraper: Carregado com sucesso! (após clicar no botão)

## Estrutura

```
whatsapp-scraper-extension/
├── manifest.json         # Configuração da extensão
├── popup.html           # Popup simplificado
├── popup.js             # Script do popup
├── js/
│   └── inject-button.js # Script que injeta o botão
├── css/
│   └── button-style.css # Estilos do botão e interface
└── images/              # Ícones da extensão
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```