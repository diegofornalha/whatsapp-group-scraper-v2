/**
 * Testes do content script do WhatsApp 20x.
 *
 * Roda com: node test/inject-button.test.js   (precisa de jsdom instalado)
 *
 * O script é carregado num contexto vm compartilhado com o jsdom, o que permite
 * inspecionar os bindings de topo (const/class) sem precisar exportá-los.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const SCRIPT_PATH = path.join(__dirname, '..', 'js', 'inject-button.js');
const SCRIPT_SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8');

const SWEEP_WAIT_MS = 400; // > SWEEP_DEBOUNCE_MS + COUNTER_DEBOUNCE_MS

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${error.message}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Monta um DOM parecido com o do WhatsApp Web. */
function buildDom({ members = [], chats = [], withDialog = true } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>
       <div id="app">
         <div id="pane-side" role="list"></div>
         <div id="main"></div>
       </div>
     </body></html>`,
    { url: 'https://web.whatsapp.com/', runScripts: 'outside-only', pretendToBeVisual: true }
  );

  const { document } = dom.window;

  // Conversas na barra lateral — NÃO devem ser coletadas.
  const paneSide = document.getElementById('pane-side');
  for (const chat of chats) {
    const item = document.createElement('div');
    item.setAttribute('role', 'listitem');
    const span = document.createElement('span');
    span.setAttribute('title', chat);
    span.textContent = chat;
    item.appendChild(span);
    paneSide.appendChild(item);
  }

  if (withDialog) {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-animate-modal-body', 'true');

    const list = document.createElement('div');
    list.setAttribute('role', 'list');
    dialog.appendChild(list);
    document.getElementById('main').appendChild(dialog);

    for (const member of members) {
      list.appendChild(buildMemberItem(document, member));
    }
  }

  return dom;
}

/** Reproduz a estrutura de spans de um participante. */
function buildMemberItem(document, { name, phone, status }) {
  const item = document.createElement('div');
  item.setAttribute('role', 'listitem');

  const nameSpan = document.createElement('span');
  nameSpan.setAttribute('title', name || phone);
  nameSpan.setAttribute('dir', 'auto');
  nameSpan.textContent = name || phone;
  item.appendChild(nameSpan);

  if (name && phone) {
    const phoneSpan = document.createElement('span');
    phoneSpan.textContent = phone;
    item.appendChild(phoneSpan);
  }

  if (status) {
    const statusSpan = document.createElement('span');
    statusSpan.className = 'copyable-text';
    statusSpan.setAttribute('title', status);
    statusSpan.textContent = status;
    item.appendChild(statusSpan);
  }

  return item;
}

/** Carrega o content script dentro do DOM e espera a inicialização. */
async function load(dom) {
  const context = dom.getInternalVMContext();
  vm.runInContext(SCRIPT_SOURCE, context, { filename: 'inject-button.js' });
  await sleep(SWEEP_WAIT_MS);
  return {
    dom,
    context,
    evaluate: expression => vm.runInContext(expression, context)
  };
}

/** Contatos coletados, como array simples. */
function collected(app) {
  return app.evaluate('JSON.stringify(memberListStore.values())');
}

async function run() {
  console.log('\nWhatsApp 20x — content script\n');

  // -------------------------------------------------------------------------
  // Operação normal
  // -------------------------------------------------------------------------

  await test('captura participantes que JÁ estavam renderizados ao abrir o modal', async () => {
    const dom = buildDom({
      members: [
        { name: 'Ana Souza', phone: '+55 11 91234-5678' },
        { name: 'Bruno Lima', phone: '+55 21 99876-5432' },
        { phone: '+55 31 98888-7777' }
      ]
    });

    const app = await load(dom);
    const items = JSON.parse(collected(app));

    assert.strictEqual(items.length, 3, `esperava 3 contatos, veio ${items.length}`);
    const names = items.map(i => i.name).filter(Boolean).sort();
    assert.deepStrictEqual(names, ['Ana Souza', 'Bruno Lima']);
    const phones = items.map(i => i.phoneNumber).sort();
    assert.ok(phones.includes('+55 31 98888-7777'), 'contato sem nome deve entrar pelo telefone');
  });

  await test('captura participantes adicionados depois (scroll virtual)', async () => {
    const dom = buildDom({ members: [{ name: 'Ana Souza', phone: '+55 11 91234-5678' }] });
    const app = await load(dom);

    assert.strictEqual(JSON.parse(collected(app)).length, 1);

    const { document } = dom.window;
    const list = document.querySelector('[role="dialog"] [role="list"]');
    list.appendChild(buildMemberItem(document, { name: 'Carla Reis', phone: '+55 41 97777-6666' }));

    await sleep(SWEEP_WAIT_MS);

    const items = JSON.parse(collected(app));
    assert.strictEqual(items.length, 2, `esperava 2 contatos, veio ${items.length}`);
    assert.ok(items.some(i => i.name === 'Carla Reis'));
  });

  await test('captura quando o modal abre DEPOIS da inicialização', async () => {
    const dom = buildDom({ withDialog: false });
    const app = await load(dom);

    assert.strictEqual(JSON.parse(collected(app)).length, 0);

    const { document } = dom.window;
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const list = document.createElement('div');
    list.setAttribute('role', 'list');
    dialog.appendChild(list);
    list.appendChild(buildMemberItem(document, { name: 'Diego Nunes', phone: '+55 51 96666-5555' }));
    document.getElementById('main').appendChild(dialog);

    await sleep(SWEEP_WAIT_MS);

    const items = JSON.parse(collected(app));
    assert.strictEqual(items.length, 1, `esperava 1 contato, veio ${items.length}`);
    assert.strictEqual(items[0].name, 'Diego Nunes');
  });

  await test('atualiza os três contadores da interface', async () => {
    const dom = buildDom({
      members: [
        { name: 'Ana Souza', phone: '+55 11 91234-5678' },
        { phone: '+55 31 98888-7777' }
      ]
    });
    const app = await load(dom);
    const { document } = dom.window;

    assert.strictEqual(document.getElementById('scraper-number-tracker').textContent, '2');
    assert.strictEqual(document.getElementById('scraper-number-tracker-filtered').textContent, '1');
    assert.strictEqual(document.getElementById('scraper-number-tracker-noname').textContent, '1');
  });

  // -------------------------------------------------------------------------
  // Privacidade e escopo da coleta
  // -------------------------------------------------------------------------

  await test('ignora a lista de conversas da barra lateral', async () => {
    const dom = buildDom({
      members: [{ name: 'Ana Souza', phone: '+55 11 91234-5678' }],
      chats: ['Grupo Família', 'Trabalho', 'Pizzaria do Zé']
    });

    const app = await load(dom);
    const items = JSON.parse(collected(app));

    assert.strictEqual(items.length, 1, `barra lateral vazou: ${JSON.stringify(items)}`);
    assert.ok(!items.some(i => i.name === 'Trabalho'));
  });

  await test('respeita a lista de nomes excluídos', async () => {
    const dom = buildDom({
      members: [
        { name: 'Você', phone: '+55 11 90000-0000' },
        { name: 'Ana Souza', phone: '+55 11 91234-5678' }
      ]
    });

    const app = await load(dom);
    const items = JSON.parse(collected(app));

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].name, 'Ana Souza');
  });

  await test('remove o "~" de nomes de push', async () => {
    const dom = buildDom({ members: [{ name: '~ Eduardo', phone: '+55 11 95555-4444' }] });
    const app = await load(dom);
    const items = JSON.parse(collected(app));

    assert.strictEqual(items[0].name, 'Eduardo');
  });

  await test('não confunde o recado (status) com o nome', async () => {
    const dom = buildDom({
      members: [{ name: 'Fernanda', phone: '+55 11 94444-3333', status: 'Disponível' }]
    });
    const app = await load(dom);
    const items = JSON.parse(collected(app));

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].name, 'Fernanda');
    assert.strictEqual(items[0].phoneNumber, '+55 11 94444-3333');
  });

  // -------------------------------------------------------------------------
  // Segurança da exportação
  // -------------------------------------------------------------------------

  await test('escapa vírgulas, aspas e quebras de linha no CSV', async () => {
    const app = await load(buildDom());

    assert.strictEqual(app.evaluate('escapeCsvValue("Souza, Ana")'), '"Souza, Ana"');
    assert.strictEqual(app.evaluate('escapeCsvValue(\'Ana "A" Souza\')'), '"Ana ""A"" Souza"');
    assert.strictEqual(app.evaluate('escapeCsvValue("linha1\\nlinha2")'), '"linha1\nlinha2"');
    assert.strictEqual(app.evaluate('escapeCsvValue("")'), '');
    assert.strictEqual(app.evaluate('escapeCsvValue(null)'), '');
  });

  await test('neutraliza injeção de fórmula (=, +, -, @)', async () => {
    const app = await load(buildDom());

    for (const payload of ['=HYPERLINK("http://x","clique")', '+1+1', '-2+3', '@SUM(A1)']) {
      const escaped = app.evaluate(`escapeCsvValue(${JSON.stringify(payload)})`);
      assert.ok(
        escaped.startsWith("'") || escaped.startsWith('"\''),
        `"${payload}" não foi desarmado: ${escaped}`
      );
    }
  });

  await test('um nome hostil não escapa da célula gerada', async () => {
    const dom = buildDom({
      members: [{ name: '=cmd|calc!A1', phone: '+55 11 93333-2222' }]
    });
    const app = await load(dom);

    const rows = JSON.parse(app.evaluate('JSON.stringify(memberListStore.toCsvDataRaw())'));
    const line = app.evaluate(
      `JSON.stringify(${JSON.stringify(rows[1])}.map(escapeCsvValue).join(','))`
    );

    assert.ok(!JSON.parse(line).includes(',=cmd'), `fórmula sobreviveu: ${line}`);
  });

  // -------------------------------------------------------------------------
  // Vazamentos e reentrância
  // -------------------------------------------------------------------------

  await test('não empilha observers ao reanexar no mesmo container', async () => {
    const dom = buildDom({ members: [{ name: 'Ana Souza', phone: '+55 11 91234-5678' }] });
    const app = await load(dom);

    const before = app.evaluate('modalObserver');
    app.evaluate('attachToModal(); attachToModal(); attachToModal();');
    const after = app.evaluate('modalObserver');

    assert.strictEqual(before, after, 'attachToModal recriou o observer no mesmo container');
  });

  await test('solta o observer quando o modal é fechado', async () => {
    const dom = buildDom({ members: [{ name: 'Ana Souza', phone: '+55 11 91234-5678' }] });
    const app = await load(dom);

    assert.notStrictEqual(app.evaluate('attachedContainer'), null);

    dom.window.document.querySelector('[role="dialog"]').remove();
    await sleep(SWEEP_WAIT_MS);

    assert.strictEqual(app.evaluate('attachedContainer'), null, 'container não foi solto');
    assert.strictEqual(app.evaluate('modalObserver'), null, 'observer não foi desconectado');
  });

  await test('dados coletados sobrevivem ao fechar e reabrir o modal', async () => {
    const dom = buildDom({ members: [{ name: 'Ana Souza', phone: '+55 11 91234-5678' }] });
    const app = await load(dom);
    const { document } = dom.window;

    document.querySelector('[role="dialog"]').remove();
    await sleep(SWEEP_WAIT_MS);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const list = document.createElement('div');
    list.setAttribute('role', 'list');
    dialog.appendChild(list);
    list.appendChild(buildMemberItem(document, { name: 'Bruno Lima', phone: '+55 21 99876-5432' }));
    document.getElementById('main').appendChild(dialog);

    await sleep(SWEEP_WAIT_MS);

    const items = JSON.parse(collected(app));
    assert.strictEqual(items.length, 2, `esperava 2 contatos acumulados, veio ${items.length}`);
  });

  await test('itens repetidos não duplicam registros', async () => {
    const dom = buildDom({ members: [{ name: 'Ana Souza', phone: '+55 11 91234-5678' }] });
    const app = await load(dom);

    app.evaluate('sweepVisibleMembers(); sweepVisibleMembers(); sweepVisibleMembers();');

    assert.strictEqual(JSON.parse(collected(app)).length, 1);
  });

  await test('um item malformado não derruba a varredura', async () => {
    const dom = buildDom({ members: [{ name: 'Ana Souza', phone: '+55 11 91234-5678' }] });
    const app = await load(dom);
    const { document } = dom.window;

    const broken = document.createElement('div');
    broken.setAttribute('role', 'listitem'); // sem nenhum span
    document.querySelector('[role="dialog"] [role="list"]').appendChild(broken);
    document
      .querySelector('[role="dialog"] [role="list"]')
      .appendChild(buildMemberItem(document, { name: 'Gabi Torres', phone: '+55 11 92222-1111' }));

    await sleep(SWEEP_WAIT_MS);

    const items = JSON.parse(collected(app));
    assert.ok(items.some(i => i.name === 'Gabi Torres'), 'varredura parou no item quebrado');
  });

  // -------------------------------------------------------------------------
  // Degradação sem chrome.storage
  // -------------------------------------------------------------------------

  await test('funciona sem a API chrome.storage disponível', async () => {
    const dom = buildDom({ members: [{ name: 'Ana Souza', phone: '+55 11 91234-5678' }] });
    const app = await load(dom);

    assert.strictEqual(app.evaluate('storageAvailable()'), false);
    assert.strictEqual(JSON.parse(collected(app)).length, 1);
  });

  console.log(`\n${passed} passaram, ${failed} falharam\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
