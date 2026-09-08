# WhatsApp 20x — Extensão

Extensão Chrome/Chromium (Manifest V3) que coleta os participantes visíveis de um
grupo no WhatsApp Web e exporta em CSV. Tudo acontece localmente no navegador —
nenhum dado é enviado para servidor algum.

> **Aviso legal.** Use apenas em grupos dos quais você já participa e cujos
> membros consentiram com o contato. A coleta e o uso posterior desses dados
> estão sujeitos à LGPD/GDPR e aos Termos de Serviço do WhatsApp.

## Instalação

1. Abra `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `whatsapp-scraper-extension`

## Como usar

1. Acesse <https://web.whatsapp.com> e faça login
2. O painel **WhatsApp 20x** aparece sozinho no canto superior direito
3. Abra um grupo, toque no nome do grupo e abra a lista de participantes
4. Clique em **▶ Coletar tudo** — a extensão rola a lista inteira sozinha
5. Baixe o CSV no formato desejado

Rolar a lista na mão também funciona (a coleta acompanha), mas **Coletar tudo**
é o caminho confiável: a lista é virtualizada e só ~20-30 das centenas de linhas
existem no DOM ao mesmo tempo. O botão vira **⏹ Parar coleta** durante a
execução, caso você queira interromper.

Fechou o painel sem querer? O botão redondo **W** no canto inferior direito reabre.

### Os três formatos de exportação

| Botão | Conteúdo |
|---|---|
| 📋 **Filtrado** | Contatos com nome, apenas o primeiro nome, sem os nomes excluídos |
| 📄 **Completo** | Tudo que foi coletado, sem tratamento |
| 📱 **Sem Nome** | Somente os números que não têm nome associado |

Os arquivos saem com BOM UTF-8, então acentuação abre correta no Excel.

## Persistência

A coleta é salva em `chrome.storage.local` e é restaurada se você recarregar a
página. O botão **Reset** apaga tudo (pede confirmação).

## Nomes excluídos

Por padrão a extensão ignora `Você`, `You`, `Ramon Socio` e
`Luciana Siguemoto Agentes`. Para trocar a lista, no console da página:

```js
chrome.storage.local.set({ wa20x_excluded: ['Você', 'You', 'Meu Nome'] });
```

Recarregue a página para aplicar.

## Verificar se está funcionando

No console (F12) devem aparecer:

```
[WhatsApp 20x] Inicializando...
[WhatsApp 20x] Pronto. Abra um grupo e toque no nome para ver os participantes.
```

E, ao abrir a lista de participantes, o status do painel muda para
**"Lista detectada — use 'Coletar tudo'"**.

## Testes

```bash
npm install --no-save jsdom          # a partir da raiz do repositório
node whatsapp-scraper-extension/test/inject-button.test.js   # 17 casos
node whatsapp-scraper-extension/test/virtual-list.test.js    # 12 casos
```

`inject-button.test.js` cobre captura (itens já renderizados, itens novos via
scroll, modal aberto depois da inicialização), isolamento da barra lateral,
escape de CSV e injeção de fórmula, ausência de vazamento de observers e
degradação sem `chrome.storage`.

`virtual-list.test.js` reproduz a geometria real da lista medida na página
(spacer de 25708px com `overflow:hidden`, linhas `position:absolute` de 72px,
scroller de 605px quatro níveis acima) e verifica a coleta completa de 357
participantes virtualizados, o fallback de evento `wheel`, a preservação de
emoji via atributo `title` e o descarte de cabeçalhos de seção.

## Estrutura

```
whatsapp-scraper-extension/
├── manifest.json              # Manifest V3 + CSP
├── popup.html / popup.js      # Popup da barra de ferramentas
├── js/
│   └── inject-button.js       # Content script: coleta + interface
├── css/
│   └── button-style.css       # Estilos do painel
├── test/
│   ├── inject-button.test.js  # Testes de coleta, CSV e observers
│   └── virtual-list.test.js   # Testes da lista virtualizada
└── images/                    # Ícones 16/48/128
```
