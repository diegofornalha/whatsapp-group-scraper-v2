# Instruções rápidas — WhatsApp 20x

## 1. Instalar / atualizar

1. Abra `chrome://extensions/`
2. Clique em **Atualizar** no card do WhatsApp 20x (ou **Carregar sem
   compactação** e escolha a pasta `whatsapp-scraper-extension`)
3. Abra <https://web.whatsapp.com> e **recarregue a página (F5)**

O passo 3 é obrigatório: content script só entra em páginas carregadas depois
da atualização da extensão.

## 2. Coletar

1. Abra um grupo
2. Toque no **nome do grupo** no topo → abre os dados do grupo
3. Abra a lista de participantes (**Ver todos**, se o grupo for grande)
4. Clique em **▶ Coletar tudo** no painel

A extensão rola a lista inteira sozinha e o contador sobe até o total do grupo.
O botão vira **⏹ Parar coleta** — clique de novo para interromper.

Por que não basta rolar na mão: a lista do WhatsApp é virtualizada. Só ~20 a 30
linhas existem na página por vez, e as que saem da tela são apagadas. Rolar até
o fim e só então coletar pegaria apenas os últimos 20.

## 3. Exportar

| Botão | Quando usar |
|---|---|
| 📋 Filtrado | Lista limpa, só primeiro nome |
| 📄 Completo | Tudo, sem tratamento |
| 📱 Sem Nome | Só os números sem nome salvo |

## Solução de problemas

**O painel não aparece**
Recarregue a página (F5). Se continuar, confira no console (F12) se aparece
`[WhatsApp 20x] Inicializando...`.

**O contador fica em zero**
Confirme que a lista aberta é a de *participantes do grupo*, não a lista de
conversas da barra lateral — a extensão ignora a barra lateral de propósito.

**"Abra a lista de participantes do grupo primeiro"**
O painel não achou uma lista rolável na tela. Abra os dados do grupo e a lista
de participantes antes de clicar em Coletar tudo.

**A coleta para antes do total do grupo**
Clique em Coletar tudo de novo: ela acumula em cima do que já tem, não recomeça
do zero.

**Perdi os dados ao recarregar**
Não deveria acontecer: a coleta é salva automaticamente e restaurada. Se
acontecer, verifique se a permissão `storage` está ativa no card da extensão.

**Quero recomeçar do zero**
Botão **Reset** (pede confirmação antes de apagar).
