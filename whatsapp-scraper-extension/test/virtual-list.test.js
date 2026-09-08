/**
 * Testes da lista virtualizada do WhatsApp Web.
 *
 * Reproduz a estrutura medida na página real:
 *
 *   nível  elemento                       scrollHeight  clientHeight  overflowY
 *   0      [role=listitem]                          72            72  visible (absolute)
 *   1      spacer                                25708         25708  hidden
 *   4      scroller                              25707           605  auto
 *
 * O spacer tem scrollHeight === clientHeight e overflow hidden: escrever
 * scrollTop nele não faz nada. Só ~20-29 linhas existem no DOM por vez, de 357
 * participantes; as que saem da viewport são destruídas.
 *
 * Roda com: node test/virtual-list.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const SCRIPT_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'inject-button.js'),
  'utf8'
);

const ROW_HEIGHT = 72;
const VIEWPORT_HEIGHT = 605;
const TOTAL_MEMBERS = 357;
const OVERSCAN = 4;

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

/** Gera os participantes de teste, imitando a mistura vista na página real. */
function makeMembers(total) {
  const members = [];
  for (let i = 0; i < total; i++) {
    if (i % 7 === 0) {
      // Sem nome salvo: só o telefone.
      members.push({ phone: `+55 11 9${String(10000000 + i).slice(0, 8)}` });
    } else {
      members.push({
        name: `Contato ${i} 😀`,
        phone: `+55 11 9${String(10000000 + i).slice(0, 8)}`
      });
    }
  }
  return members;
}

/**
 * Constrói o DOM virtualizado.
 * Retorna helpers para inspecionar quantas linhas existem de fato.
 */
function buildVirtualDom(members, { emojiMangling = true, lockScrollTop = false } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="app">
       <div id="pane-side" role="list"></div>
       <div id="main">
         <div role="dialog" data-animate-modal-body="true">
           <div class="lvl3"><div class="lvl2">
             <div class="scroller"><div class="spacer" role="list"></div></div>
           </div></div>
         </div>
       </div>
     </div></body></html>`,
    { url: 'https://web.whatsapp.com/', runScripts: 'outside-only', pretendToBeVisual: true }
  );

  const { window } = dom;
  const { document } = window;

  const scroller = document.querySelector('.scroller');
  const spacer = document.querySelector('.spacer');

  const totalHeight = members.length * ROW_HEIGHT;

  // --- Geometria: jsdom não faz layout, então definimos as medidas na mão. ---
  let scrollTop = 0;
  let wheelUsed = false;

  const maxScroll = () => Math.max(0, totalHeight - 1 - VIEWPORT_HEIGHT);

  function moveTo(value) {
    scrollTop = Math.max(0, Math.min(maxScroll(), Math.round(value)));
    render();
  }

  Object.defineProperty(scroller, 'scrollHeight', { get: () => totalHeight - 1 });
  Object.defineProperty(scroller, 'clientHeight', { get: () => VIEWPORT_HEIGHT });
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    // lockScrollTop reproduz a lista que ignora escrita direta e só responde a wheel.
    set: lockScrollTop ? () => {} : moveTo
  });

  scroller.scrollTo = lockScrollTop ? () => {} : ((x, y) => moveTo(y));
  scroller.scrollBy = lockScrollTop ? () => {} : ((x, y) => moveTo(scrollTop + y));

  scroller.addEventListener('wheel', event => {
    wheelUsed = true;
    if (lockScrollTop) moveTo(scrollTop + event.deltaY);
  });

  // O spacer é do tamanho total e NÃO rola — como na página real.
  Object.defineProperty(spacer, 'scrollHeight', { get: () => totalHeight });
  Object.defineProperty(spacer, 'clientHeight', { get: () => totalHeight });

  // getComputedStyle do jsdom não resolve as classes; devolvemos o que medimos.
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = element => {
    if (element === scroller) return { overflowY: 'auto' };
    if (element === spacer) return { overflowY: 'hidden' };
    if (element && element.getAttribute && element.getAttribute('role') === 'listitem') {
      return { overflowY: 'visible' };
    }
    return originalGetComputedStyle(element);
  };

  // --- Virtualização: só as linhas visíveis existem no DOM. ---
  let renderCount = 0;
  let maxRowsAtOnce = 0;

  function render() {
    renderCount++;

    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const last = Math.min(
      members.length - 1,
      Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN
    );

    while (spacer.firstChild) spacer.removeChild(spacer.firstChild);

    for (let i = first; i <= last; i++) {
      spacer.appendChild(buildRow(document, members[i], i * ROW_HEIGHT, emojiMangling));
    }

    maxRowsAtOnce = Math.max(maxRowsAtOnce, spacer.children.length);
  }

  render();

  return {
    dom,
    scroller,
    spacer,
    stats: () => ({ renderCount, maxRowsAtOnce, rowsNow: spacer.children.length, wheelUsed })
  };
}

/** Uma linha de participante, com os spans duplicados como na página real. */
function buildRow(document, member, top, emojiMangling) {
  const item = document.createElement('div');
  item.setAttribute('role', 'listitem');
  item.style.position = 'absolute';
  item.style.top = `${top}px`;
  item.style.height = `${ROW_HEIGHT}px`;

  const label = member.name || member.phone;

  const nameSpan = document.createElement('span');
  nameSpan.setAttribute('title', label);
  nameSpan.setAttribute('dir', 'auto');
  // O WhatsApp substitui emoji por <img>, então o textContent vem mutilado.
  nameSpan.textContent = emojiMangling ? label.replace(/\p{Extended_Pictographic}/gu, '') : label;
  item.appendChild(nameSpan);

  if (member.name && member.phone) {
    // O telefone aparece duplicado: um visível e uma cópia oculta pra seleção.
    for (let i = 0; i < 2; i++) {
      const phoneSpan = document.createElement('span');
      phoneSpan.textContent = member.phone;
      item.appendChild(phoneSpan);
    }
  }

  return item;
}

/** Cabeçalho de seção alfabético — [role=listitem] que não é contato. */
function buildSectionHeader(document, letter) {
  const item = document.createElement('div');
  item.setAttribute('role', 'listitem');
  const span = document.createElement('span');
  span.setAttribute('title', letter);
  span.textContent = letter;
  item.appendChild(span);
  return item;
}

async function load(dom) {
  const context = dom.getInternalVMContext();
  vm.runInContext(SCRIPT_SOURCE, context, { filename: 'inject-button.js' });
  await sleep(400);
  return { evaluate: expression => vm.runInContext(expression, context) };
}

async function run() {
  console.log('\nWhatsApp 20x — lista virtualizada\n');

  // -------------------------------------------------------------------------
  // Causa nº 1: container de scroll
  // -------------------------------------------------------------------------

  await test('escolhe o scroller real, não o spacer (scrollHeight === clientHeight)', async () => {
    const harness = buildVirtualDom(makeMembers(TOTAL_MEMBERS));
    const app = await load(harness.dom);

    const isScroller = app.evaluate('attachedScroller === document.querySelector(".scroller")');
    const isSpacer = app.evaluate('attachedScroller === document.querySelector(".spacer")');

    assert.strictEqual(isSpacer, false, 'anexou no spacer — scrollTop seria ignorado');
    assert.strictEqual(isScroller, true, 'não encontrou o scroller real');
  });

  await test('o spacer segue servindo de raiz de varredura', async () => {
    const harness = buildVirtualDom(makeMembers(TOTAL_MEMBERS));
    const app = await load(harness.dom);

    const containsRows = app.evaluate(
      'attachedContainer.querySelectorAll(\'[role="listitem"]\').length > 0'
    );
    assert.strictEqual(containsRows, true, 'a raiz de varredura não contém as linhas');
  });

  // -------------------------------------------------------------------------
  // Causa nº 2: virtualização
  // -------------------------------------------------------------------------

  await test(`coleta os ${TOTAL_MEMBERS} participantes rolando a lista inteira`, async () => {
    const harness = buildVirtualDom(makeMembers(TOTAL_MEMBERS));
    const app = await load(harness.dom);

    const before = app.evaluate('memberListStore.size');
    assert.ok(before > 0 && before < 40, `varredura inicial deveria pegar só a viewport, veio ${before}`);

    await app.evaluate(`
      (async () => {
        const btn = document.getElementById('scraper-collect-all');
        await collectAll(btn);
      })()
    `);

    const total = app.evaluate('memberListStore.size');
    const stats = harness.stats();

    assert.ok(
      stats.maxRowsAtOnce < 40,
      `o teste não virtualizou de verdade (${stats.maxRowsAtOnce} linhas simultâneas)`
    );
    assert.strictEqual(
      total,
      TOTAL_MEMBERS,
      `esperava ${TOTAL_MEMBERS} contatos, veio ${total} (máx ${stats.maxRowsAtOnce} linhas no DOM por vez)`
    );
  });

  await test('não pula blocos entre passos de rolagem', async () => {
    const members = makeMembers(TOTAL_MEMBERS);
    const harness = buildVirtualDom(members);
    const app = await load(harness.dom);

    await app.evaluate(`
      (async () => { await collectAll(document.getElementById('scraper-collect-all')); })()
    `);

    const collected = new Set(
      JSON.parse(app.evaluate('JSON.stringify(memberListStore.values())'))
        .map(item => item.phoneNumber.replace(/\D/g, ''))
    );

    const missing = members
      .map(m => m.phone.replace(/\D/g, ''))
      .filter(digits => !collected.has(digits));

    assert.strictEqual(missing.length, 0, `${missing.length} contato(s) pulado(s): ${missing.slice(0, 5)}`);
  });

  await test('para no fim da lista, não em loop infinito', async () => {
    const harness = buildVirtualDom(makeMembers(120));
    const app = await load(harness.dom);

    await app.evaluate(`
      (async () => { await collectAll(document.getElementById('scraper-collect-all')); })()
    `);

    assert.strictEqual(app.evaluate('autoScrollActive'), false, 'a coleta não encerrou');
    assert.ok(
      harness.stats().renderCount < 500,
      `rolou demais (${harness.stats().renderCount} renders para 120 contatos)`
    );
  });

  await test('cai para evento de wheel quando scrollTop é ignorado', async () => {
    const members = makeMembers(120);
    // lockScrollTop: escrita direta em scrollTop e scrollTo não fazem nada,
    // só o evento de wheel move a lista — como acontece na página real.
    const harness = buildVirtualDom(members, { lockScrollTop: true });
    const app = await load(harness.dom);

    await app.evaluate(`
      (async () => { await collectAll(document.getElementById('scraper-collect-all')); })()
    `);

    assert.strictEqual(harness.stats().wheelUsed, true, 'nunca tentou o fallback de wheel');
    assert.strictEqual(
      app.evaluate('memberListStore.size'),
      members.length,
      'o fallback de wheel não coletou a lista inteira'
    );
  });

  await test('botão avisa quando a lista não está aberta', async () => {
    const dom = new JSDOM(
      '<!doctype html><html><body><div id="app"><div id="main"></div></div></body></html>',
      { url: 'https://web.whatsapp.com/', runScripts: 'outside-only', pretendToBeVisual: true }
    );
    const app = await load(dom);

    await app.evaluate(`
      (async () => { await collectAll(document.getElementById('scraper-collect-all')); })()
    `);

    const status = dom.window.document.getElementById('scraper-status').textContent;
    assert.ok(
      status.includes('Abra a lista'),
      `esperava aviso ao usuário, status era: "${status}"`
    );
  });

  // -------------------------------------------------------------------------
  // Causa nº 3: emoji e spans duplicados
  // -------------------------------------------------------------------------

  await test('lê o nome do atributo title, preservando emoji', async () => {
    const harness = buildVirtualDom([
      { name: 'Simone 🌸', phone: '+55 11 91111-2222' }
    ]);
    const app = await load(harness.dom);

    const items = JSON.parse(app.evaluate('JSON.stringify(memberListStore.values())'));
    assert.strictEqual(items[0].name, 'Simone 🌸', `textContent mutilado venceu: "${items[0].name}"`);
  });

  await test('telefone duplicado em dois spans não vira dois contatos', async () => {
    const harness = buildVirtualDom([
      { name: 'Ana Souza', phone: '+55 11 91234-5678' }
    ]);
    const app = await load(harness.dom);

    assert.strictEqual(app.evaluate('memberListStore.size'), 1);
  });

  await test('mesmo número em formatos diferentes é um contato só', async () => {
    const harness = buildVirtualDom(makeMembers(1));
    const app = await load(harness.dom);

    app.evaluate(`
      memberListStore.upsert(contactKey('+55 11 91234-5678', 'Ana'), { phoneNumber: '+55 11 91234-5678', name: 'Ana' });
      memberListStore.upsert(contactKey('+5511912345678', 'Ana'), { phoneNumber: '+5511912345678', name: 'Ana' });
      memberListStore.upsert(contactKey('55 11 9 1234 5678', 'Ana'), { phoneNumber: '55 11 9 1234 5678', name: 'Ana' });
    `);

    const anas = JSON.parse(app.evaluate('JSON.stringify(memberListStore.values())'))
      .filter(item => item.name === 'Ana');

    assert.strictEqual(anas.length, 1, `mesmo número virou ${anas.length} registros`);
  });

  // -------------------------------------------------------------------------
  // Causa nº 4: linhas que não são contato
  // -------------------------------------------------------------------------

  await test('ignora cabeçalhos de seção ("P", "~")', async () => {
    const harness = buildVirtualDom([
      { name: 'Ana Souza', phone: '+55 11 91234-5678' }
    ]);
    const { document } = harness.dom.window;

    harness.spacer.insertBefore(buildSectionHeader(document, 'P'), harness.spacer.firstChild);
    harness.spacer.appendChild(buildSectionHeader(document, '~'));

    const app = await load(harness.dom);
    const items = JSON.parse(app.evaluate('JSON.stringify(memberListStore.values())'));

    assert.strictEqual(items.length, 1, `cabeçalhos vazaram: ${JSON.stringify(items)}`);
    assert.strictEqual(items[0].name, 'Ana Souza');
  });

  await test('não descarta nomes curtos legítimos com telefone', async () => {
    const harness = buildVirtualDom([{ name: 'Jô', phone: '+55 11 93333-4444' }]);
    const app = await load(harness.dom);

    const items = JSON.parse(app.evaluate('JSON.stringify(memberListStore.values())'));
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].name, 'Jô');
  });

  console.log(`\n${passed} passaram, ${failed} falharam\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
