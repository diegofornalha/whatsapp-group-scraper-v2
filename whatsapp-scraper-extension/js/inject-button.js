// Script simplificado - Apenas injeta botão para carregar o scraper
console.log('⚡ WhatsApp 20x: Injetando botão...');

// Variáveis globais para o scraper
let memberListStore;
let logsTracker;
let modalObserver;
let uiWidget; // Variável global para o widget
const counterId = 'scraper-number-tracker';
const exportName = 'whatsAppExport';

// Lista de nomes a serem excluídos na exportação
const EXCLUDED_NAMES = ['Você', 'Ramon Socio', 'You', 'Luciana Siguemoto Agentes'];

// Função helper para verificar se deve excluir o contato
function shouldExclude(name) {
  return !name || EXCLUDED_NAMES.includes(name);
}

// Aguarda o WhatsApp carregar
function waitForWhatsApp() {
  const checkInterval = setInterval(() => {
    const app = document.getElementById('app');
    if (app) {
      clearInterval(checkInterval);
      injectButton();
    }
  }, 1000);
}

// Injeta o botão simples
function injectButton() {
  // Verifica se já foi carregado
  if (document.getElementById('whatsapp-scraper-widget')) {
    console.log('⚠️ WhatsApp 20x já está carregado');
    // Se já existe mas está oculto, mostra
    if (uiWidget) {
      uiWidget.show();
    }
    return;
  }
  
  console.log('⚡ WhatsApp 20x: Carregando automaticamente...');
  
  // Carrega o scraper diretamente, sem mostrar o modal
  setTimeout(() => {
    initializeScraper();
    console.log('✅ WhatsApp 20x: Carregado automaticamente!');
  }, 500);
}

// Função para reabrir o modal (pode ser chamada externamente)
window.reopenWhatsAppScraper = function() {
  if (uiWidget && document.getElementById('whatsapp-scraper-widget')) {
    uiWidget.show();
  } else {
    initializeScraper();
  }
};

// Funções utilitárias
function exportToCsv(data, filename) {
  const csv = data.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

class ListStorage {
  constructor() {
    this.data = [];
  }
  
  add(item) {
    this.data.push(item);
  }
  
  getAll() {
    return this.data;
  }
  
  clear() {
    this.data = [];
  }
  
  get length() {
    return this.data.length;
  }
}

class UIContainer {
  constructor(title) {
    this.container = document.createElement('div');
    this.container.className = 'whatsapp-scraper-widget';
    this.container.id = 'whatsapp-scraper-widget';
    
    // Criar estrutura com botão de fechar
    const header = document.createElement('div');
    header.style.position = 'relative';
    header.style.paddingRight = '30px';
    
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    header.appendChild(titleElement);
    
    // Botão de fechar
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'scraper-close-button';
    closeButton.textContent = '✖'; // Usando X mais visível
    closeButton.title = 'Fechar WhatsApp 20x';
    closeButton.setAttribute('aria-label', 'Fechar modal');
    
    // Adicionar múltiplos event listeners para garantir funcionamento
    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    }, true);
    
    // Backup com mousedown para garantir resposta
    closeButton.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Apenas botão esquerdo do mouse
        e.preventDefault();
      }
    });
    
    // Adicionar header primeiro, depois o botão de fechar por cima
    this.container.appendChild(header);
    this.container.appendChild(closeButton);
    document.body.appendChild(this.container);
    
    // Criar botão de reabrir
    this.createReopenButton();
  }
  
  appendChild(element) {
    this.container.appendChild(element);
  }
  
  hide() {
    this.container.classList.add('hidden');
    const reopenBtn = document.getElementById('scraper-reopen-button');
    if (reopenBtn) {
      reopenBtn.classList.remove('hidden');
    }
  }
  
  show() {
    this.container.classList.remove('hidden');
    const reopenBtn = document.getElementById('scraper-reopen-button');
    if (reopenBtn) {
      reopenBtn.classList.add('hidden');
    }
  }
  
  createReopenButton() {
    const reopenButton = document.createElement('button');
    reopenButton.id = 'scraper-reopen-button';
    reopenButton.className = 'scraper-reopen-button hidden';
    reopenButton.innerHTML = 'W';
    reopenButton.title = 'Abrir WhatsApp 20x';
    reopenButton.onclick = () => this.show();
    document.body.appendChild(reopenButton);
  }
}

function createCta(text, onClick) {
  const button = document.createElement('button');
  button.textContent = text;
  button.className = 'whatsapp-scraper-widget-button';
  if (typeof onClick === 'string') {
    button.appendChild(document.createTextNode(text));
  } else {
    button.onclick = onClick;
  }
  return button;
}

function createSpacer() {
  const spacer = document.createElement('div');
  spacer.style.height = '10px';
  return spacer;
}

function createTextSpan(text) {
  const span = document.createElement('span');
  span.textContent = text;
  span.style.display = 'inline';
  span.style.margin = '0';
  return span;
}

class HistoryTracker {
  constructor() {
    this.history = new Set();
  }
  
  has(id) {
    return this.history.has(id);
  }
  
  track(id) {
    this.history.add(id);
  }
}

// Funções do scraper
function cleanName(name) {
  const nameClean = name.trim();
  // Remove ~ no início do nome, com ou sem espaço
  return nameClean.replace(/^~\s*/, '');
}

class WhatsAppStorage extends ListStorage {
  get headers() {
    return [
      'Phone Number',
      'Name'
    ];
  }
  
  itemToRow(item) {
    // Ignorar contatos sem nome ou contatos próprios
    if (shouldExclude(item.name)) {
      return null; // Retornar null para indicar que deve ser ignorado
    }
    
    // Também verificar se o phoneNumber contém um nome excluído (quando não há telefone real)
    if (!item.name && item.phoneNumber) {
      // Se não tem nome mas o phoneNumber não parece ser um telefone (não começa com + ou número)
      if (!/^[+\d]/.test(item.phoneNumber)) {
        // É um nome no campo phoneNumber, verificar se deve excluir
        if (shouldExclude(item.phoneNumber)) {
          return null;
        }
      } else {
        // É um número sem nome, filtrar
        return null;
      }
    }
    
    return [
      item.phoneNumber || "",
      item.name ? item.name.split(' ')[0] : ""
    ];
  }
  
  toCsvData() {
    const rows = [this.headers];
    this.data.forEach(item => {
      const row = this.itemToRow(item);
      if (row) { // Apenas adicionar se não for null
        rows.push(row);
      }
    });
    return rows;
  }
  
  // Novo método para exportar todos os contatos sem filtro
  toCsvDataRaw() {
    const rows = [this.headers];
    this.data.forEach(item => {
      rows.push([
        item.phoneNumber || "",
        item.name || "" // Nome completo sem tratamento
      ]);
    });
    return rows;
  }
  
  // Novo método para exportar apenas contatos sem nome (números apenas)
  toCsvDataNoName() {
    const rows = [["Phone Number"]]; // Apenas coluna de telefone
    this.data.forEach(item => {
      // Incluir apenas se não tem nome ou se o nome está na lista de exclusão
      if (!item.name || item.name.trim() === '') {
        // Verificar se phoneNumber é realmente um número (começa com + ou dígito)
        if (item.phoneNumber && /^[+\d]/.test(item.phoneNumber)) {
          rows.push([item.phoneNumber]);
        }
      }
    });
    return rows;
  }
  
  addElem(id, data, update) {
    const existing = this.data.find(item => item.profileId === id);
    if (existing && update) {
      Object.assign(existing, data);
    } else if (!existing) {
      this.add(data);
    }
  }
  
  getCount() {
    return this.length;
  }
}

async function updateCounter() {
  const tracker = document.getElementById(counterId);
  const trackerFiltered = document.getElementById(counterId + '-filtered');
  const trackerNoName = document.getElementById(counterId + '-noname');
  
  if(tracker){
    const countValue = memberListStore.getCount();
    tracker.textContent = countValue.toString();
  }
  
  if(trackerFiltered){
    // Contar apenas os contatos que passariam pelo filtro
    let filteredCount = 0;
    memberListStore.data.forEach(item => {
      const row = memberListStore.itemToRow(item);
      if (row) filteredCount++;
    });
    trackerFiltered.textContent = filteredCount.toString();
  }
  
  if(trackerNoName){
    // Contar apenas contatos sem nome
    let noNameCount = 0;
    memberListStore.data.forEach(item => {
      if (!item.name || item.name.trim() === '') {
        if (item.phoneNumber && /^[+\d]/.test(item.phoneNumber)) {
          noNameCount++;
        }
      }
    });
    trackerNoName.textContent = noNameCount.toString();
  }
}

// Carrega o scraper quando o botão é clicado
// NOTA: Esta função não é mais usada pois o scraper carrega automaticamente
// Mantida para compatibilidade/referência
function loadScraper() {
  const button = document.getElementById('whatsapp-scraper-button');
  const container = document.getElementById('whatsapp-scraper-container');
  
  // Muda o texto do botão
  button.textContent = 'Carregando...';
  button.disabled = true;
  
  console.log('🚀 WhatsApp 20x: Carregando...');
  
  // Inicializa o scraper diretamente
  setTimeout(() => {
    initializeScraper();
    
    // Remove o botão após carregar
    setTimeout(() => {
      container.style.opacity = '0';
      container.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => container.remove(), 300);
    }, 1000);
  }, 100);
}

// Inicializa o scraper
function initializeScraper() {
  console.log('🚀 WhatsApp 20x: Inicializando...');
  
  // Se já existe o widget, apenas mostra
  if (uiWidget && document.getElementById('whatsapp-scraper-widget')) {
    uiWidget.show();
    return;
  }
  
  // Inicializar o storage
  memberListStore = new WhatsAppStorage();
  
  // Criar UI
  uiWidget = new UIContainer('WhatsApp 20x');
  
  // History Tracker
  logsTracker = new HistoryTracker();
  
  // Button Download Tratado (Filtrado)
  const btnDownloadFiltered = createCta('Download Filtrado');
  btnDownloadFiltered.onclick = async function() {
    const timestamp = new Date().toISOString();
    const data = memberListStore.toCsvData();
    try{
      exportToCsv(data, exportName + '-filtrado-' + timestamp + '.csv');
      console.log('✅ CSV filtrado exportado com sucesso');
    }catch(err){
      console.error('Error while generating filtered export');
      console.log(err.stack);
    }
  };
  
  // Criar span para o contador dentro do botão filtrado
  btnDownloadFiltered.innerHTML = '';
  btnDownloadFiltered.appendChild(createTextSpan('📋 Filtrado ('));
  const counterSpanFiltered = createTextSpan('0');
  counterSpanFiltered.id = counterId + '-filtered';
  btnDownloadFiltered.appendChild(counterSpanFiltered);
  btnDownloadFiltered.appendChild(createTextSpan(')')); 
  btnDownloadFiltered.style.backgroundColor = '#25D366';
  btnDownloadFiltered.style.marginBottom = '5px';
  
  // Button Download Completo (Sem Tratamento)
  const btnDownloadRaw = createCta('Download Completo');
  btnDownloadRaw.onclick = async function() {
    const timestamp = new Date().toISOString();
    const data = memberListStore.toCsvDataRaw();
    try{
      exportToCsv(data, exportName + '-completo-' + timestamp + '.csv');
      console.log('✅ CSV completo exportado com sucesso');
    }catch(err){
      console.error('Error while generating raw export');
      console.log(err.stack);
    }
  };
  
  // Criar span para o contador dentro do botão completo
  btnDownloadRaw.innerHTML = '';
  btnDownloadRaw.appendChild(createTextSpan('📄 Completo ('));
  const counterSpan = createTextSpan('0');
  counterSpan.id = counterId;
  btnDownloadRaw.appendChild(counterSpan);
  btnDownloadRaw.appendChild(createTextSpan(')'));
  btnDownloadRaw.style.backgroundColor = '#128C7E';
  btnDownloadRaw.style.marginBottom = '5px';
  
  // Button Download Sem Nome (Apenas Números)
  const btnDownloadNoName = createCta('Download Sem Nome');
  btnDownloadNoName.onclick = async function() {
    const timestamp = new Date().toISOString();
    const data = memberListStore.toCsvDataNoName();
    try{
      exportToCsv(data, exportName + '-sem-nome-' + timestamp + '.csv');
      console.log('✅ CSV sem nome exportado com sucesso');
    }catch(err){
      console.error('Error while generating no-name export');
      console.log(err.stack);
    }
  };
  
  // Criar span para o contador dentro do botão sem nome
  btnDownloadNoName.innerHTML = '';
  btnDownloadNoName.appendChild(createTextSpan('📱 Sem Nome ('));
  const counterSpanNoName = createTextSpan('0');
  counterSpanNoName.id = counterId + '-noname';
  btnDownloadNoName.appendChild(counterSpanNoName);
  btnDownloadNoName.appendChild(createTextSpan(')'));
  btnDownloadNoName.style.backgroundColor = '#E67E22';
  btnDownloadNoName.style.marginBottom = '10px';
  
  uiWidget.appendChild(btnDownloadFiltered);
  uiWidget.appendChild(btnDownloadRaw);
  uiWidget.appendChild(btnDownloadNoName);
  uiWidget.appendChild(createSpacer());
  
  // Button Reset
  const btnReinit = createCta('Reset');
  btnReinit.onclick = async function() {
    memberListStore.clear();
    await updateCounter();
    console.log('Data cleared');
  };
  
  uiWidget.appendChild(btnReinit);
  
  // Button Ir para Disparador
  const btnDisparador = createCta('Ir para Disparador');
  btnDisparador.style.marginTop = '10px';
  btnDisparador.style.backgroundColor = '#0066cc';
  btnDisparador.style.color = 'white';
  btnDisparador.onclick = function() {
    // Abrir o disparador em nova aba
    window.open('https://agentesintegrados.com.br', '_blank');
    console.log('Redirecionando para o disparador...');
  };
  
  uiWidget.appendChild(btnDisparador);
  uiWidget.appendChild(createSpacer());
  
  // Status text
  const statusText = createTextSpan('Aguardando abertura de grupo...');
  statusText.id = 'scraper-status';
  statusText.style.display = 'block';
  uiWidget.appendChild(statusText);
  
  // Start monitoring
  startMonitoring();
  
  console.log('✅ WhatsApp 20x: Interface criada com sucesso!');
  console.log('📌 Abra um grupo e clique no nome para ver os membros');
}

function listenModalChanges() {
  const modalElems = document.querySelectorAll('[data-animate-modal-body="true"]');
  if(modalElems.length === 0) return;
  
  const modalElem = modalElems[0];
  const targetNode = modalElem.querySelectorAll("div[style*='height']")[1];
  
  if(!targetNode) return;
  
  const config = { attributes: true, childList: true, subtree: true };
  
  const callback = (mutationList) => {
    for (const mutation of mutationList) {
      if (mutation.type === "attributes") {
        const target = mutation.target;
        const tagName = target.tagName;
        
        if(
          tagName.toLowerCase() !== 'div' ||
          target.getAttribute("role") !== "listitem"
        ){
          continue;
        }
        
        const listItem = target;
        
        setTimeout(async () => {
          let profileName = "";
          let profilePhone = "";
          
          // Name
          const titleElems = listItem.querySelectorAll("span[title]:not(.copyable-text)");
          if(titleElems.length > 0){
            const text = titleElems[0].textContent;
            if(text){
              const name = cleanName(text);
              if(name && name.length > 0){
                profileName = name;
              }
            }
          }
          
          if(profileName.length === 0){
            return;
          }
          
          // Phone
          const phoneElems = listItem.querySelectorAll("span[style*='height']:not([title])");
          if(phoneElems.length > 0){
            const text = phoneElems[0].textContent;
            if(text){
              const textClean = text.trim();
              if(textClean && textClean.length > 0){
                profilePhone = textClean;
              }
            }
          }
          
          if(profileName){
            // Ignorar contatos próprios e sem nome válido
            if (shouldExclude(profileName)) {
              console.log('Ignorando contato próprio ou inválido:', profileName);
              return;
            }
            
            const identifier = profilePhone ? profilePhone : profileName;
            console.log('Encontrado:', identifier);
            
            const data = {};
            
            if(profilePhone){
              data.phoneNumber = profilePhone;
              if(profileName){
                data.name = profileName;
              }
            }else{
              if(profileName){
                data.phoneNumber = profileName;
              }
            }
            
            memberListStore.addElem(
              identifier, {
                profileId: identifier,
                ...data
              },
              true
            );
            
            updateCounter();
            updateStatus('Coletando: ' + profileName);
          }
        }, 10);
      }
    }
  };
  
  modalObserver = new MutationObserver(callback);
  modalObserver.observe(targetNode, config);
  updateStatus('Modal detectado - Role a lista para coletar dados');
}

function stopListeningModalChanges() {
  if(modalObserver){
    modalObserver.disconnect();
    updateStatus('Coleta pausada');
  }
}

function updateStatus(message) {
  const statusText = document.getElementById('scraper-status');
  if(statusText) {
    statusText.textContent = message;
  }
}

function startMonitoring() {
  updateStatus('Monitorando página...');
  
  function bodyCallback(mutationList) {
    for (const mutation of mutationList) {
      if (mutation.type === "childList") {
        if(mutation.addedNodes.length > 0){
          mutation.addedNodes.forEach((node) => {
            if(node.nodeType === Node.ELEMENT_NODE) {
              const modalElems = node.querySelectorAll('[data-animate-modal-body="true"]');
              if(modalElems.length > 0){
                setTimeout(() => {
                  listenModalChanges();
                }, 10);
              }
            }
          });
        }
        
        if(mutation.removedNodes.length > 0){
          mutation.removedNodes.forEach((node) => {
            if(node.nodeType === Node.ELEMENT_NODE) {
              const modalElems = node.querySelectorAll('[data-animate-modal-body="true"]');
              if(modalElems.length > 0){
                stopListeningModalChanges();
              }
            }
          });
        }
      }
    }
  }
  
  const bodyConfig = { attributes: false, childList: true, subtree: true };
  const bodyObserver = new MutationObserver(bodyCallback);
  
  const app = document.getElementById('app');
  if(app){
    bodyObserver.observe(app, bodyConfig);
  } else {
    bodyObserver.observe(document.body, bodyConfig);
  }
}

// Inicia quando a página carregar
waitForWhatsApp();