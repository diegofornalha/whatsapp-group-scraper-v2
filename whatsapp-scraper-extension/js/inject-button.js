/**
 * @module WhatsApp20x/ContentScript
 * @description Coleta membros visíveis do modal de participantes do WhatsApp Web
 *              e permite exportar em CSV. Toda a coleta é local ao navegador.
 * @security Nenhum dado sai do navegador. CSV é escapado contra injeção de fórmula.
 *           Nenhuma escrita via innerHTML com conteúdo vindo da página.
 * @privacy Dados ficam em chrome.storage.local e podem ser apagados no botão "Reset".
 * @performance Sem polling. Varredura debounced (>=150ms) só sobre os itens visíveis
 *              do modal (dezenas), não sobre o dataset inteiro.
 * @legal O uso deve respeitar os Termos de Serviço do WhatsApp e a LGPD/GDPR.
 *        A coleta só ocorre em grupos que o próprio usuário já pode visualizar.
 */

'use strict';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const COUNTER_ID = 'scraper-number-tracker';
const EXPORT_NAME = 'whatsAppExport';

const STORAGE_KEY_CONTACTS = 'wa20x_contacts';
const STORAGE_KEY_EXCLUDED = 'wa20x_excluded';

/** Intervalos de debounce (ms). CLAUDE.md exige mínimo de 50ms. */
const SWEEP_DEBOUNCE_MS = 150;
const COUNTER_DEBOUNCE_MS = 200;
const PERSIST_DEBOUNCE_MS = 1000;

/** Nomes ignorados na coleta. Sobrescritível em chrome.storage.local. */
const DEFAULT_EXCLUDED_NAMES = [
  'Você',
  'You',
  'Ramon Socio',
  'Luciana Siguemoto Agentes'
];

/** Um identificador é telefone se casar com isto. */
const PHONE_REGEX = /^\+?\d[\d\s\-()]{7,}$/;

/** Textos internos do WhatsApp que nunca são nomes de contato. */
const NOT_A_NAME = new Set(['default-contact-refreshed', '']);

/** Passo de rolagem automática, como fração da altura visível do scroller. */
const AUTOSCROLL_STEP_RATIO = 0.6;
/** Espera de render após cada rolagem (ms), além de dois requestAnimationFrame. */
const AUTOSCROLL_SETTLE_MS = 300;
/** Rodadas sem contato novo exigidas para considerar a lista esgotada. */
const AUTOSCROLL_IDLE_ROUNDS = 3;
/** Trava de segurança: máximo de rodadas de rolagem por execução. */
const AUTOSCROLL_MAX_ROUNDS = 2000;

let excludedNames = new Set(DEFAULT_EXCLUDED_NAMES);

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

let memberListStore;
let uiWidget;

/** Observer do modal de participantes atualmente anexado. */
let modalObserver = null;
/** Raiz da varredura: contém todos os [role="listitem"] renderizados. */
let attachedContainer = null;
/**
 * Elemento que de fato rola. Pode ser vários níveis acima do listitem: o pai
 * direto é um spacer de altura total com overflow hidden, onde scrollTop é
 * ignorado. Rolar o elemento errado é o que fazia a coleta parar na 1ª rodada.
 */
let attachedScroller = null;
/** Listener de scroll registrado no scroller anexado. */
let attachedScrollHandler = null;
/** Execução de rolagem automática em andamento. */
let autoScrollActive = false;

/** Observer da árvore da aplicação (detecta abertura/fechamento do modal). */
let appObserver = null;

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/**
 * Agenda `fn` para rodar no máximo uma vez a cada `wait` ms.
 * @returns {Function} versão debounced, com método `.cancel()`
 */
function debounce(fn, wait) {
  let timer = null;
  const wrapped = function (...args) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
  wrapped.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}

/**
 * Trata um erro seguindo o padrão obrigatório do CLAUDE.md:
 * log detalhado, aviso amigável ao usuário e retorno de um fallback seguro.
 */
function handleError(context, error, userMessage, fallback) {
  console.error(`[WhatsApp 20x][${context}]: ${error && error.message}`, error);
  notifyUser(userMessage);
  return fallback;
}

/** Mostra uma mensagem transitória na área de status do widget. */
function notifyUser(message) {
  const statusText = document.getElementById('scraper-status');
  if (!statusText) return;
  const previous = statusText.textContent;
  statusText.textContent = message;
  statusText.dataset.transient = 'true';
  setTimeout(() => {
    if (statusText.dataset.transient === 'true') {
      statusText.dataset.transient = 'false';
      statusText.textContent = previous;
    }
  }, 4000);
}

function updateStatus(message) {
  const statusText = document.getElementById('scraper-status');
  if (!statusText) return;
  // Não sobrescreve uma notificação de erro que ainda está visível.
  if (statusText.dataset.transient === 'true') return;
  statusText.textContent = message;
}

function cleanName(name) {
  // Remove o "~" que o WhatsApp prefixa em nomes de push (com ou sem espaço).
  return String(name || '').trim().replace(/^~\s*/, '');
}

function shouldExclude(name) {
  return !name || excludedNames.has(name);
}

/**
 * Chave canônica de um contato.
 * O mesmo participante aparece com formatações diferentes conforme o span
 * ("+55 11 91234-5678" vs "+5511912345678"), então normalizamos para dígitos.
 */
function contactKey(phone, name) {
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits) return `tel:${digits}`;
  }
  return name ? `nome:${name}` : '';
}

/**
 * A lista tem [role="listitem"] que não são participantes: cabeçalhos de seção
 * alfabéticos ("P") e separadores cujo texto é só "~". Um nome de uma letra só,
 * sem telefone algum, nunca é contato.
 */
function isLikelyMemberRow(name, phone) {
  if (phone) return true;
  if (!name) return false;
  const alphanumeric = name.replace(/[^\p{L}\p{N}]/gu, '');
  return alphanumeric.length >= 2;
}

// ---------------------------------------------------------------------------
// Exportação CSV
// ---------------------------------------------------------------------------

/**
 * Escapa um valor para CSV (RFC 4180) e neutraliza injeção de fórmula.
 * @security Um nome iniciado por = + - @ TAB ou CR é executado como fórmula por
 *           Excel/Sheets/LibreOffice. Prefixamos com apóstrofo para desarmar.
 */
function escapeCsvValue(value) {
  let text = value === null || value === undefined ? '' : String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/["\n\r,;]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * Gera e baixa um CSV.
 * @param {Array<Array<string>>} rows matriz de linhas já ordenada (inclui header)
 * @param {string} filename nome do arquivo
 */
function exportToCsv(rows, filename) {
  const csv = rows.map(row => row.map(escapeCsvValue).join(',')).join('\r\n');

  // BOM UTF-8: sem ele o Excel no Windows quebra acentuação.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  // Revogar de imediato pode cancelar o download em alguns builds do Chrome.
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Timestamp seguro para nome de arquivo (sem ":" nem "."). */
function fileTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// ---------------------------------------------------------------------------
// Armazenamento
// ---------------------------------------------------------------------------

/**
 * Store de contatos indexado por identificador.
 * Usa Map para lookup O(1) — a versão anterior fazia find() linear por mutação,
 * o que tornava a coleta O(n²) em grupos grandes.
 */
class WhatsAppStorage {
  constructor() {
    /** @type {Map<string, {profileId: string, phoneNumber?: string, name?: string}>} */
    this.items = new Map();
  }

  get headers() {
    return ['Phone Number', 'Name'];
  }

  get size() {
    return this.items.size;
  }

  /**
   * Insere ou atualiza um contato.
   * @returns {boolean} true se algo mudou (novo registro ou campo preenchido)
   */
  upsert(id, data) {
    const existing = this.items.get(id);

    if (!existing) {
      this.items.set(id, { profileId: id, ...data });
      return true;
    }

    let changed = false;
    for (const [key, value] of Object.entries(data)) {
      // Só sobrescreve com valor não-vazio; evita apagar um nome já capturado
      // quando o mesmo item volta ao DOM sem o nome renderizado.
      if (value && existing[key] !== value) {
        existing[key] = value;
        changed = true;
      }
    }
    return changed;
  }

  clear() {
    this.items.clear();
  }

  values() {
    return Array.from(this.items.values());
  }

  replaceAll(items) {
    this.items.clear();
    for (const item of items) {
      if (!item) continue;
      // Re-chaveia: dados salvos por versões antigas usavam o telefone cru.
      const key = contactKey(item.phoneNumber, item.name) || item.profileId;
      if (key) {
        this.items.set(key, { ...item, profileId: key });
      }
    }
  }

  /** Um item entra na exportação filtrada? */
  isFiltered(item) {
    if (shouldExclude(item.name)) return false;

    if (!item.name && item.phoneNumber) {
      // Sem nome: só interessa se o campo for de fato um telefone.
      if (!PHONE_REGEX.test(item.phoneNumber)) {
        return !shouldExclude(item.phoneNumber);
      }
      return false;
    }

    return true;
  }

  /** Um item é "sem nome" (só número)? */
  isNameless(item) {
    if (item.name && item.name.trim() !== '') return false;
    return Boolean(item.phoneNumber && /^[+\d]/.test(item.phoneNumber));
  }

  /** Contatos com nome, primeiro nome apenas. */
  toCsvDataFiltered() {
    const rows = [this.headers];
    for (const item of this.items.values()) {
      if (!this.isFiltered(item)) continue;
      rows.push([
        item.phoneNumber || '',
        item.name ? item.name.split(' ')[0] : ''
      ]);
    }
    return rows;
  }

  /** Tudo que foi coletado, sem tratamento. */
  toCsvDataRaw() {
    const rows = [this.headers];
    for (const item of this.items.values()) {
      rows.push([item.phoneNumber || '', item.name || '']);
    }
    return rows;
  }

  /** Apenas números sem nome associado. */
  toCsvDataNoName() {
    const rows = [['Phone Number']];
    for (const item of this.items.values()) {
      if (this.isNameless(item)) {
        rows.push([item.phoneNumber]);
      }
    }
    return rows;
  }

  /** Contagens para os três botões, em uma única passada. */
  counts() {
    let total = 0;
    let filtered = 0;
    let nameless = 0;

    for (const item of this.items.values()) {
      total++;
      if (this.isFiltered(item)) filtered++;
      if (this.isNameless(item)) nameless++;
    }

    return { total, filtered, nameless };
  }
}

// ---------------------------------------------------------------------------
// Persistência (chrome.storage.local)
// ---------------------------------------------------------------------------

function storageAvailable() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

async function loadSettings() {
  if (!storageAvailable()) return;
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY_EXCLUDED);
    const list = stored[STORAGE_KEY_EXCLUDED];
    if (Array.isArray(list) && list.length > 0) {
      excludedNames = new Set(list);
    }
  } catch (error) {
    handleError('loadSettings', error, 'Não foi possível ler as configurações.', null);
  }
}

async function loadContacts() {
  if (!storageAvailable()) return;
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY_CONTACTS);
    const items = stored[STORAGE_KEY_CONTACTS];
    if (Array.isArray(items) && items.length > 0) {
      memberListStore.replaceAll(items);
      console.log(`[WhatsApp 20x] ${items.length} contato(s) restaurado(s) da sessão anterior.`);
    }
  } catch (error) {
    handleError('loadContacts', error, 'Não foi possível restaurar a coleta anterior.', null);
  }
}

const persistContacts = debounce(async () => {
  if (!storageAvailable()) return;
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY_CONTACTS]: memberListStore.values()
    });
  } catch (error) {
    handleError('persistContacts', error, 'Falha ao salvar. Exporte o CSV agora.', null);
  }
}, PERSIST_DEBOUNCE_MS);

async function clearPersistedContacts() {
  if (!storageAvailable()) return;
  try {
    await chrome.storage.local.remove(STORAGE_KEY_CONTACTS);
  } catch (error) {
    handleError('clearPersistedContacts', error, 'Falha ao limpar os dados salvos.', null);
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

class UIContainer {
  constructor(title) {
    this.container = document.createElement('div');
    this.container.className = 'whatsapp-scraper-widget';
    this.container.id = 'whatsapp-scraper-widget';

    const header = document.createElement('div');
    header.className = 'scraper-widget-header';

    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    header.appendChild(titleElement);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'scraper-close-button';
    closeButton.textContent = '✖';
    closeButton.title = 'Fechar WhatsApp 20x';
    closeButton.setAttribute('aria-label', 'Fechar WhatsApp 20x');
    closeButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.hide();
    });

    this.container.appendChild(header);
    this.container.appendChild(closeButton);
    document.body.appendChild(this.container);

    this.createReopenButton();
  }

  appendChild(element) {
    this.container.appendChild(element);
  }

  hide() {
    this.container.classList.add('hidden');
    const reopenBtn = document.getElementById('scraper-reopen-button');
    if (reopenBtn) reopenBtn.classList.remove('hidden');
  }

  show() {
    this.container.classList.remove('hidden');
    const reopenBtn = document.getElementById('scraper-reopen-button');
    if (reopenBtn) reopenBtn.classList.add('hidden');
  }

  createReopenButton() {
    const reopenButton = document.createElement('button');
    reopenButton.type = 'button';
    reopenButton.id = 'scraper-reopen-button';
    reopenButton.className = 'scraper-reopen-button hidden';
    reopenButton.textContent = 'W';
    reopenButton.title = 'Abrir WhatsApp 20x';
    reopenButton.setAttribute('aria-label', 'Abrir WhatsApp 20x');
    reopenButton.addEventListener('click', () => this.show());
    document.body.appendChild(reopenButton);
  }
}

/**
 * Cria um botão com rótulo e contador embutido.
 * @param {string} label texto antes do contador
 * @param {string} counterId id do span do contador
 * @param {string} background cor de fundo
 * @param {Function} onClick handler de clique
 */
function createCounterButton(label, counterId, background, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'whatsapp-scraper-widget-button';
  button.style.backgroundColor = background;
  button.addEventListener('click', onClick);

  button.appendChild(document.createTextNode(`${label} (`));

  const counter = document.createElement('span');
  counter.id = counterId;
  counter.textContent = '0';
  button.appendChild(counter);

  button.appendChild(document.createTextNode(')'));

  return button;
}

function createCta(text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'whatsapp-scraper-widget-button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function createSpacer() {
  const spacer = document.createElement('div');
  spacer.className = 'scraper-spacer';
  return spacer;
}

/** Recalcula os três contadores em uma única passada pelo dataset. */
const updateCounter = debounce(() => {
  if (!memberListStore) return;

  const { total, filtered, nameless } = memberListStore.counts();

  const totalEl = document.getElementById(COUNTER_ID);
  const filteredEl = document.getElementById(`${COUNTER_ID}-filtered`);
  const namelessEl = document.getElementById(`${COUNTER_ID}-noname`);

  if (totalEl) totalEl.textContent = String(total);
  if (filteredEl) filteredEl.textContent = String(filtered);
  if (namelessEl) namelessEl.textContent = String(nameless);
}, COUNTER_DEBOUNCE_MS);

function downloadHandler(label, buildRows, suffix) {
  return () => {
    try {
      const rows = buildRows();
      if (rows.length <= 1) {
        notifyUser('Nada para exportar ainda.');
        return;
      }
      exportToCsv(rows, `${EXPORT_NAME}-${suffix}-${fileTimestamp()}.csv`);
      console.log(`[WhatsApp 20x] CSV ${label} exportado (${rows.length - 1} linha(s)).`);
    } catch (error) {
      handleError(`export:${suffix}`, error, `Falha ao exportar o CSV ${label}.`, null);
    }
  };
}

// ---------------------------------------------------------------------------
// Extração de contatos
// ---------------------------------------------------------------------------

/**
 * Extrai nome e telefone de um `[role="listitem"]` do modal de participantes.
 * Tolerante à estrutura de DOM: tenta várias estratégias em ordem de confiança,
 * porque o WhatsApp Web muda as classes com frequência.
 * @returns {{name: string, phone: string}|null}
 */
function extractContact(listItem) {
  let profileName = '';
  let profilePhone = '';

  // 1) Identificador principal: span com title que não é o "recado".
  const titleElems = listItem.querySelectorAll('span[title]:not(.copyable-text)');
  for (const elem of titleElems) {
    const text = cleanName(elem.getAttribute('title') || elem.textContent);
    if (text && !NOT_A_NAME.has(text)) {
      profileName = text;
      break;
    }
  }

  // 2) Fallback: qualquer span com dir="auto" e texto útil.
  if (!profileName) {
    const dirSpans = listItem.querySelectorAll('span[dir="auto"]');
    for (const elem of dirSpans) {
      const text = cleanName(elem.textContent);
      if (text && !NOT_A_NAME.has(text)) {
        profileName = text;
        break;
      }
    }
  }

  if (!profileName) return null;

  // Se o identificador principal já é um telefone, ele É o telefone —
  // e o nome real, se existir, está em outro span.
  if (PHONE_REGEX.test(profileName)) {
    profilePhone = profileName;
    profileName = '';

    const candidates = listItem.querySelectorAll('span');
    for (const elem of candidates) {
      const text = cleanName(elem.textContent);
      if (!text || NOT_A_NAME.has(text)) continue;
      if (text === profilePhone || PHONE_REGEX.test(text)) continue;
      profileName = text;
      break;
    }
  }

  // Procura o telefone em qualquer span com formato numérico.
  if (!profilePhone) {
    const candidates = listItem.querySelectorAll('span');
    for (const elem of candidates) {
      const text = (elem.textContent || '').trim();
      if (text && text !== profileName && PHONE_REGEX.test(text)) {
        profilePhone = text;
        break;
      }
    }
  }

  if (!profileName && !profilePhone) return null;

  return { name: profileName, phone: profilePhone };
}

/**
 * Varre TODOS os itens atualmente renderizados no modal e registra os novos.
 *
 * Esta é a correção central do "às vezes pega, às vezes não": a versão anterior
 * só reagia a mutações de atributo, então os participantes que já estavam no DOM
 * quando o modal abriu nunca eram capturados. Varrer é barato porque o WhatsApp
 * usa scroll virtual — só existem algumas dezenas de itens por vez.
 */
function sweepVisibleMembers() {
  if (!memberListStore) return;

  // Sem container anexado não há como distinguir participantes de conversas
  // da barra lateral — varrer o documento inteiro contaminaria a coleta.
  if (!attachedContainer || !attachedContainer.isConnected) return;

  const listItems = attachedContainer.querySelectorAll('[role="listitem"]');
  if (listItems.length === 0) return;

  let changed = false;
  let lastName = '';

  for (const listItem of listItems) {
    let contact;
    try {
      contact = extractContact(listItem);
    } catch (error) {
      // Um item malformado não pode derrubar a varredura inteira.
      console.error('[WhatsApp 20x][extractContact]:', error);
      continue;
    }

    if (!contact) continue;

    const { name, phone } = contact;

    if (name && shouldExclude(name)) continue;
    if (!name && phone && shouldExclude(phone)) continue;

    // Descarta cabeçalhos de seção e separadores.
    if (!isLikelyMemberRow(name, phone)) continue;

    const identifier = contactKey(phone, name);
    if (!identifier) continue;

    const data = phone
      ? { phoneNumber: phone, ...(name ? { name } : {}) }
      : { phoneNumber: name };

    if (memberListStore.upsert(identifier, data)) {
      changed = true;
      lastName = name || phone;
    }
  }

  if (changed) {
    updateCounter();
    persistContacts();
    if (!autoScrollActive) {
      updateStatus(`Coletando: ${lastName}`);
    }
  }

  return changed;
}

const scheduleSweep = debounce(sweepVisibleMembers, SWEEP_DEBOUNCE_MS);

// ---------------------------------------------------------------------------
// Rolagem automática
// ---------------------------------------------------------------------------

/**
 * Espera a lista virtual renderizar as novas linhas.
 * Dois requestAnimationFrame garantem que o frame de layout passou; o timeout
 * cobre o preenchimento assíncrono das linhas. Sem isso, blocos inteiros de
 * contatos são pulados entre um passo de rolagem e o seguinte.
 */
function settleAfterScroll() {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, AUTOSCROLL_SETTLE_MS));
    });
  });
}

/**
 * Avança o scroller em `step` px, com fallbacks.
 * A lista do WhatsApp às vezes ignora escrita direta em scrollTop e só responde
 * a um evento de wheel real.
 * @returns {Promise<boolean>} true se a posição mudou
 */
async function advanceScroller(scroller, step) {
  const before = scroller.scrollTop;

  scroller.scrollTop = before + step;
  await settleAfterScroll();
  if (scroller.scrollTop !== before) return true;

  scroller.dispatchEvent(new WheelEvent('wheel', {
    deltaY: step,
    deltaMode: 0,
    bubbles: true,
    cancelable: true
  }));
  await settleAfterScroll();
  if (scroller.scrollTop !== before) return true;

  if (typeof scroller.scrollTo === 'function') {
    scroller.scrollTo(0, before + step);
    await settleAfterScroll();
  }

  return scroller.scrollTop !== before;
}

function isAtBottom(scroller) {
  return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 5;
}

/**
 * Rola a lista de participantes do topo ao fim, acumulando os contatos.
 *
 * Necessário porque a lista é virtualizada: só ~20-30 das centenas de linhas
 * existem no DOM ao mesmo tempo, e as que saem da viewport são destruídas.
 * Não adianta rolar até o fim e varrer — no fim só restam as últimas linhas.
 */
async function collectAll(button) {
  if (autoScrollActive) {
    autoScrollActive = false;
    return;
  }

  const scroller = attachedScroller;

  if (!scroller || !scroller.isConnected) {
    notifyUser('Abra a lista de participantes do grupo primeiro.');
    return;
  }

  autoScrollActive = true;
  button.textContent = '⏹ Parar coleta';

  const startedWith = memberListStore.size;

  try {
    scroller.scrollTop = 0;
    await settleAfterScroll();
    sweepVisibleMembers();

    let idleRounds = 0;
    let lastSize = memberListStore.size;

    for (let round = 0; round < AUTOSCROLL_MAX_ROUNDS && autoScrollActive; round++) {
      const step = Math.max(200, Math.floor(scroller.clientHeight * AUTOSCROLL_STEP_RATIO));
      const moved = await advanceScroller(scroller, step);

      sweepVisibleMembers();

      if (memberListStore.size === lastSize) {
        idleRounds++;
      } else {
        idleRounds = 0;
        lastSize = memberListStore.size;
      }

      updateStatus(`Coletando... ${memberListStore.size} contato(s)`);

      // Para só quando a lista esgotou E estamos de fato no fim.
      if (idleRounds >= AUTOSCROLL_IDLE_ROUNDS && isAtBottom(scroller)) break;

      // Scroller travado e sem contatos novos: insistir não leva a lugar algum.
      if (!moved && idleRounds >= AUTOSCROLL_IDLE_ROUNDS) break;
    }

    const collected = memberListStore.size - startedWith;
    updateStatus(
      autoScrollActive
        ? `Coleta concluída: ${memberListStore.size} contato(s) (+${collected})`
        : `Coleta interrompida: ${memberListStore.size} contato(s)`
    );
  } catch (error) {
    handleError('collectAll', error, 'Erro durante a coleta automática.', null);
  } finally {
    autoScrollActive = false;
    button.textContent = '▶ Coletar tudo';
    updateCounter();
    persistContacts();
  }
}

// ---------------------------------------------------------------------------
// Detecção do modal de participantes
// ---------------------------------------------------------------------------

/**
 * Encontra o ancestral que realmente rola.
 *
 * O pai direto do listitem é um spacer de altura total (scrollHeight ===
 * clientHeight, overflow hidden) usado pelo scroll virtual para posicionar as
 * linhas em `position: absolute`. Escrever scrollTop nele não faz nada — e era
 * por isso que a rolagem não avançava e a lista parecia ter acabado.
 * O scroller de verdade fica alguns níveis acima.
 */
function findScrollParent(element) {
  let node = element;
  while (node && node !== document.body) {
    const overflowY = window.getComputedStyle(node).overflowY;
    // A margem de 20px evita casar com o spacer, cuja diferença é zero.
    if (overflowY !== 'visible' && node.scrollHeight > node.clientHeight + 20) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * A lista de conversas da barra lateral também usa [role="listitem"].
 * Coletá-la encheria o CSV com nomes de conversa em vez de participantes.
 */
function isChatSidebar(element) {
  return Boolean(element.closest('#pane-side')) || element.id === 'pane-side';
}

/**
 * Localiza o container que agrupa os `[role="listitem"]` dos participantes.
 * Cobre tanto o modal ("Ver todos") quanto o painel lateral de dados do grupo,
 * escolhendo sempre o candidato com mais itens renderizados.
 * @returns {Element|null}
 */
function findMemberListContainer() {
  const candidates = [
    ...document.querySelectorAll('[data-animate-modal-body="true"]'),
    ...document.querySelectorAll('[role="dialog"]'),
    ...document.querySelectorAll('[role="list"]')
  ];

  let best = null;
  let bestCount = 0;

  for (const candidate of candidates) {
    if (isChatSidebar(candidate)) continue;

    const items = candidate.querySelectorAll('[role="listitem"]');
    if (items.length === 0) continue;
    if (isChatSidebar(items[0])) continue;

    if (items.length > bestCount) {
      bestCount = items.length;
      best = { root: candidate, firstItem: items[0] };
    }
  }

  if (!best) return null;

  const scroller = findScrollParent(best.firstItem);
  const validScroller = scroller && !isChatSidebar(scroller) ? scroller : null;

  // A raiz da varredura precisa conter TODOS os listitems renderizados; o
  // scroller serve, e ainda dá o listener de scroll de graça. Sem ele, cai no
  // spacer (pai direto), que também contém todas as linhas mas não rola.
  return {
    root: validScroller || best.firstItem.parentElement || best.root,
    scroller: validScroller
  };
}

function detachFromModal() {
  if (modalObserver) {
    modalObserver.disconnect();
    modalObserver = null;
  }

  if (attachedScroller && attachedScrollHandler) {
    attachedScroller.removeEventListener('scroll', attachedScrollHandler);
  }

  attachedScrollHandler = null;
  attachedScroller = null;

  if (attachedContainer) {
    attachedContainer = null;
    updateStatus('Aguardando abertura da lista de participantes...');
  }
}

/**
 * Anexa (ou reanexa) a coleta à lista de participantes.
 * Idempotente: se já estamos no mesmo container, não faz nada — a versão
 * anterior empilhava um MutationObserver novo a cada chamada.
 */
function attachToModal() {
  const found = findMemberListContainer();

  if (!found) {
    if (attachedContainer && !attachedContainer.isConnected) {
      detachFromModal();
    }
    return;
  }

  const { root, scroller } = found;

  if (root === attachedContainer && attachedContainer.isConnected) {
    // Já observando este container: só garante que nada novo escapou.
    scheduleSweep();
    return;
  }

  detachFromModal();
  attachedContainer = root;
  attachedScroller = scroller;

  modalObserver = new MutationObserver(() => scheduleSweep());
  modalObserver.observe(root, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true
  });

  // Scroll virtual pode reciclar nós sem gerar mutação observável no lote certo.
  if (attachedScroller) {
    attachedScrollHandler = () => scheduleSweep();
    attachedScroller.addEventListener('scroll', attachedScrollHandler, { passive: true });
  }

  updateStatus(
    attachedScroller
      ? 'Lista detectada — use "Coletar tudo"'
      : 'Lista detectada — role a lista para coletar'
  );

  // Varredura imediata: captura quem já estava renderizado.
  sweepVisibleMembers();
}

const scheduleAttach = debounce(attachToModal, SWEEP_DEBOUNCE_MS);

function startMonitoring() {
  if (appObserver) return;

  const root = document.getElementById('app') || document.body;

  appObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      if (mutation.addedNodes.length === 0 && mutation.removedNodes.length === 0) continue;
      // Não inspecionamos o nó: modais aparecem em etapas e checar o conteúdo
      // no instante da inserção é justamente o que fazia a coleta falhar.
      scheduleAttach();
      return;
    }
  });

  appObserver.observe(root, { childList: true, subtree: true });

  updateStatus('Monitorando página...');

  // O modal pode já estar aberto quando a extensão inicializa.
  attachToModal();
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

async function initializeScraper() {
  if (uiWidget && document.getElementById('whatsapp-scraper-widget')) {
    uiWidget.show();
    return;
  }

  console.log('[WhatsApp 20x] Inicializando...');

  memberListStore = new WhatsAppStorage();

  await loadSettings();
  await loadContacts();

  uiWidget = new UIContainer('WhatsApp 20x');

  const btnCollectAll = createCta('▶ Coletar tudo', () => collectAll(btnCollectAll));
  btnCollectAll.id = 'scraper-collect-all';
  btnCollectAll.title = 'Rola a lista inteira e coleta todos os participantes';
  uiWidget.appendChild(btnCollectAll);
  uiWidget.appendChild(createSpacer());

  const btnFiltered = createCounterButton(
    '📋 Filtrado',
    `${COUNTER_ID}-filtered`,
    '#25D366',
    downloadHandler('filtrado', () => memberListStore.toCsvDataFiltered(), 'filtrado')
  );

  const btnRaw = createCounterButton(
    '📄 Completo',
    COUNTER_ID,
    '#128C7E',
    downloadHandler('completo', () => memberListStore.toCsvDataRaw(), 'completo')
  );

  const btnNoName = createCounterButton(
    '📱 Sem Nome',
    `${COUNTER_ID}-noname`,
    '#E67E22',
    downloadHandler('sem nome', () => memberListStore.toCsvDataNoName(), 'sem-nome')
  );

  uiWidget.appendChild(btnFiltered);
  uiWidget.appendChild(btnRaw);
  uiWidget.appendChild(btnNoName);
  uiWidget.appendChild(createSpacer());

  const btnReset = createCta('Reset', async () => {
    const { total } = memberListStore.counts();
    if (total > 0 && !window.confirm(`Apagar os ${total} contato(s) coletados?`)) {
      return;
    }
    memberListStore.clear();
    persistContacts.cancel();
    await clearPersistedContacts();
    updateCounter();
    notifyUser('Dados apagados.');
  });

  uiWidget.appendChild(btnReset);
  uiWidget.appendChild(createSpacer());

  const statusText = document.createElement('span');
  statusText.id = 'scraper-status';
  statusText.textContent = 'Aguardando abertura de grupo...';
  uiWidget.appendChild(statusText);

  updateCounter();
  startMonitoring();

  console.log('[WhatsApp 20x] Pronto. Abra um grupo e toque no nome para ver os participantes.');
}

/** Permite reabrir o widget a partir do console ou de outro script. */
window.reopenWhatsAppScraper = function () {
  if (uiWidget && document.getElementById('whatsapp-scraper-widget')) {
    uiWidget.show();
  } else {
    initializeScraper();
  }
};

/**
 * Aguarda o container da aplicação existir.
 * Usa MutationObserver em vez de setInterval (CLAUDE.md proíbe polling aqui).
 */
function waitForWhatsApp() {
  if (document.getElementById('app')) {
    initializeScraper();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById('app')) return;
    observer.disconnect();
    clearTimeout(fallbackTimer);
    initializeScraper();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Rede de segurança: se o #app nunca aparecer, sobe assim mesmo no body.
  const fallbackTimer = setTimeout(() => {
    observer.disconnect();
    initializeScraper();
  }, 30000);
}

waitForWhatsApp();
