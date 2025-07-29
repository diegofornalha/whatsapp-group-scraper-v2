import {
    exportToCsv,
    ListStorage,
    UIContainer,
    createCta,
    createSpacer,
    createTextSpan,
    HistoryTracker,
    LogCategory
} from 'browser-scraping-utils';

interface WhatsAppMember {
    profileId: string
    name?: string
    description?: string
    phoneNumber?: string
    source?: string
}

interface GroupInfo {
    name: string
    element: HTMLElement
}

function cleanName(name: string): string{
    const nameClean = name.trim()
    return nameClean.replace('~ ', '')
}

function cleanDescription(description: string) : string | null {
    const descriptionClean = description.trim()
    if(
        !descriptionClean.match(/Loading About/i) &&
        !descriptionClean.match(/I am using WhatsApp/i) &&
        !descriptionClean.match(/Available/i)
    ){
        return descriptionClean
    }
    return null;
}

class WhatsAppStorage extends ListStorage<WhatsAppMember> {
    get headers() {
        return [
            'Phone Number',
            'Name',
            'Description',
            'Source'
        ]
    }
    itemToRow(item: WhatsAppMember): string[]{
        return [
            item.phoneNumber ? item.phoneNumber : "",
            item.name ? item.name : "",
            item.description ? item.description : "",
            item.source ? item.source : ""
        ]
    }
}

const memberListStore = new WhatsAppStorage({
    name: "whatsapp-scraper"
});
const counterId = 'scraper-number-tracker'
const exportName = 'whatsAppExport';
let logsTracker: HistoryTracker;
let selectedGroup: string | null = null;
let isScrapingActive = false;

async function updateConter(){
    const tracker = document.getElementById(counterId)
    if(tracker){
        const countValue = await memberListStore.getCount();
        tracker.textContent = countValue.toString()
    }
}

const uiWidget = new UIContainer();

function buildCTABtns(){
    // History Tracker
    logsTracker = new HistoryTracker({
        onDelete: async (groupId: string) => {
            console.log(`Delete ${groupId}`);
            await memberListStore.deleteFromGroupId(groupId);
            await updateConter();
        },
        divContainer: uiWidget.history,
        maxLogs: 4
    })

    // Group Selector
    const groupSelector = document.createElement('select');
    groupSelector.id = 'group-selector';
    groupSelector.style.cssText = `
        margin: 0 8px;
        padding: 4px;
        border-radius: 4px;
        border: 1px solid #ccc;
        background: white;
        font-family: monospace;
        font-size: 14px;
        max-width: 200px;
    `;
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Selecione um grupo...';
    groupSelector.appendChild(defaultOption);
    
    groupSelector.addEventListener('change', (e) => {
        selectedGroup = (e.target as HTMLSelectElement).value;
        updateStartButton();
        if (selectedGroup) {
            logsTracker.addHistoryLog({
                label: `Grupo selecionado: ${selectedGroup}`,
                category: LogCategory.LOG
            });
        }
    });

    // Start/Stop Button
    const btnStartStop = createCta();
    btnStartStop.id = 'start-stop-btn';
    btnStartStop.appendChild(createTextSpan('Iniciar Extração', {
        idAttribute: 'start-stop-text'
    }));
    btnStartStop.style.opacity = '0.5';
    btnStartStop.style.cursor = 'not-allowed';
    
    btnStartStop.addEventListener('click', function() {
        if (!selectedGroup) {
            alert('Por favor, selecione um grupo primeiro!');
            return;
        }
        
        if (!isScrapingActive) {
            // Clicar no grupo selecionado
            const groups = document.querySelectorAll('[role="listitem"] [data-testid="cell-frame-container"]');
            for (const group of groups) {
                const nameElem = group.querySelector('span[title]');
                if (nameElem && nameElem.textContent === selectedGroup) {
                    (group as HTMLElement).click();
                    isScrapingActive = true;
                    updateStartButton();
                    logsTracker.addHistoryLog({
                        label: `Iniciando extração: ${selectedGroup}`,
                        category: LogCategory.LOG
                    });
                    
                    // Aguarda um pouco e tenta abrir o modal de membros
                    setTimeout(() => {
                        openMembersModal();
                    }, 1000);
                    break;
                }
            }
        } else {
            // Parar extração
            isScrapingActive = false;
            updateStartButton();
            logsTracker.addHistoryLog({
                label: 'Extração pausada',
                category: LogCategory.LOG
            });
        }
    });

    // Button Download
    const btnDownload = createCta();
    btnDownload.appendChild(createTextSpan('Download\u00A0'))
    btnDownload.appendChild(createTextSpan('0', {
        bold: true,
        idAttribute: counterId
    }))
    btnDownload.appendChild(createTextSpan('\u00A0users'))

    btnDownload.addEventListener('click', async function() {
        const timestamp = new Date().toISOString()
        const groupName = selectedGroup ? `-${selectedGroup.replace(/[^a-z0-9]/gi, '_')}` : '';
        const data = await memberListStore.toCsvData()
        try{
            exportToCsv(`${exportName}${groupName}-${timestamp}.csv`, data)
        }catch(err){
            console.error('Error while generating export');
            // @ts-ignore
            console.log(err.stack)
        }
    });

    // Button Reinit
    const btnReinit = createCta();
    btnReinit.appendChild(createTextSpan('Reset'))
    btnReinit.addEventListener('click', async function() {
        if (confirm('Tem certeza que deseja limpar todos os dados?')) {
            await memberListStore.clear();
            logsTracker.cleanLogs();
            await updateConter();
            isScrapingActive = false;
            updateStartButton();
        }
    });

    // Add controls to UI
    uiWidget.addCta(groupSelector);
    uiWidget.addCta(createSpacer());
    uiWidget.addCta(btnStartStop);
    uiWidget.addCta(createSpacer());
    uiWidget.addCta(btnDownload);
    uiWidget.addCta(createSpacer());
    uiWidget.addCta(btnReinit);

    // Draggable
    uiWidget.makeItDraggable();

    // Render
    uiWidget.render()

    // Initial
    window.setTimeout(()=>{
        updateConter();
        updateGroupList();
    }, 1000)
}

function updateStartButton() {
    const btn = document.getElementById('start-stop-btn');
    const text = document.getElementById('start-stop-text');
    
    if (!btn || !text) return;
    
    if (!selectedGroup) {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        text.textContent = 'Selecione um grupo';
    } else if (isScrapingActive) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = '#ff4444';
        text.textContent = 'Parar Extração';
    } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = '#44ff44';
        text.textContent = 'Iniciar Extração';
    }
}

function updateGroupList() {
    const selector = document.getElementById('group-selector') as HTMLSelectElement;
    if (!selector) return;
    
    // Limpa opções existentes (exceto a primeira)
    while (selector.options.length > 1) {
        selector.remove(1);
    }
    
    // Busca grupos disponíveis
    const groups = document.querySelectorAll('[role="listitem"] [data-testid="cell-frame-container"]');
    const groupNames = new Set<string>();
    
    groups.forEach(group => {
        const nameElem = group.querySelector('span[title]');
        if (nameElem && nameElem.textContent) {
            const name = nameElem.textContent.trim();
            if (name && !groupNames.has(name)) {
                groupNames.add(name);
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                selector.appendChild(option);
            }
        }
    });
    
    logsTracker.addHistoryLog({
        label: `${groupNames.size} grupos encontrados`,
        category: LogCategory.LOG
    });
}

function openMembersModal() {
    // Tenta clicar no botão de informações do grupo
    const groupHeader = document.querySelector('header [data-testid="conversation-info-header"]');
    if (groupHeader) {
        (groupHeader as HTMLElement).click();
        
        setTimeout(() => {
            // Procura pelo link "Ver todos" ou similar
            const viewAllLinks = document.querySelectorAll('span[role="button"]');
            for (const link of viewAllLinks) {
                if (link.textContent && link.textContent.match(/View all|Ver todos|See all/i)) {
                    (link as HTMLElement).click();
                    logsTracker.addHistoryLog({
                        label: 'Modal de membros aberto',
                        category: LogCategory.LOG
                    });
                    break;
                }
            }
        }, 500);
    }
}

let modalObserver: MutationObserver;

function listenModalChanges(){
    const source = selectedGroup;
    const modalElems = document.querySelectorAll('[data-animate-modal-body="true"]');

    const modalElem = modalElems[0]
    const targetNode = modalElem.querySelectorAll("div[style*='height']")[1];
    
    const config = { attributes: true, childList: true, subtree: true };
    
    const callback = (
        mutationList: MutationRecord[],
    ) => {
        if (!isScrapingActive) return;
        
        for (const mutation of mutationList) {
            if (mutation.type === "childList") {
                if(mutation.addedNodes.length>0){
                    const node = mutation.addedNodes[0]
                    const text = node.textContent;
                    if(text){
                        const textClean = text.trim();
                        if(textClean.length>0){
                            if(
                                !textClean.match(/Loading About/i) &&
                                !textClean.match(/I am using WhatsApp/i) &&
                                !textClean.match(/Available/i)
                            ){
                                // console.log(text)
                            }
                        }
                    }
                }
            }else if (mutation.type === "attributes") {
                const target = mutation.target as HTMLElement;
                const tagName = target.tagName;
    
                if(
                    ['div'].indexOf(tagName.toLowerCase())===-1 ||
                    target.getAttribute("role")!=="listitem"
                ){
                    continue;
                }
    
                const listItem = target;
    
                window.setTimeout(async ()=>{
                    let profileName = "";
                    let profileDescription = "";
                    let profilePhone = ""
                    
                    // Name
                    const titleElems = listItem.querySelectorAll("span[title]:not(.copyable-text)");
                    if(titleElems.length>0){
                        const text = titleElems[0].textContent
                        if(text){
                            const name = cleanName(text);
                            if(name && name.length>0){
                                profileName = name;
                            }
                        }
                    }
    
                    if(profileName.length===0){
                        return;
                    }
    
                    // Description
                    const descriptionElems = listItem.querySelectorAll("span[title].copyable-text");
        
                    if(descriptionElems.length>0){
                        const text = descriptionElems[0].textContent;
                        if(text){
                            const description = cleanDescription(text);
                            if(description && description.length>0){
                                profileDescription = description;
                            }
                        }
                    }
    
                    // Phone
                    const phoneElems = listItem.querySelectorAll("span[style*='height']:not([title])");
                    if(phoneElems.length>0){
                        const text = phoneElems[0].textContent;
                        if(text){
                            const textClean = text.trim()
                            
                            if(textClean && textClean.length>0){
                                profilePhone = textClean;
                            }
                        }
                    }
                    
    
                    if(profileName){
                        const identifier = profilePhone ? profilePhone : profileName;
                        console.log(identifier)

                        const data: {
                            name?: string,
                            description?: string,
                            phoneNumber?: string,
                            source?: string
                        } = {
                        }

                        if(source){
                            data.source = source;
                        }

                        if(profileDescription){
                            data.description = profileDescription
                        }
                        if(profilePhone){
                            data.phoneNumber = profilePhone;
                            if(profileName){
                                data.name = profileName
                            }
                        }else{
                            if(profileName){
                                data.phoneNumber = profileName;
                            }
                        }

                        await memberListStore.addElem(
                            identifier, {
                                profileId: identifier,
                                ...data
                            },
                            true // Update
                        )
        
                        let profileStr = profileName;
                        if(profilePhone){
                            profileStr += ` - ${profilePhone}`
                        }
                        if(profileDescription){
                            profileStr += ` - ${profileDescription}`
                        }
                        
                        logsTracker.addHistoryLog({
                            label: `Extraído: ${profileName}`,
                            category: LogCategory.LOG
                        })

                        updateConter()
                    }    
                }, 10)
            }
        }
    };
    
    modalObserver = new MutationObserver(callback);
    modalObserver.observe(targetNode, config);
}

function stopListeningModalChanges(){
    if(modalObserver){
        modalObserver.disconnect();
    }
}

function main(): void {
    buildCTABtns();

    logsTracker.addHistoryLog({
        label: "Scraper Seletivo Iniciado",
        category: LogCategory.LOG
    })

    // Atualiza lista de grupos periodicamente
    setInterval(() => {
        if (!isScrapingActive) {
            updateGroupList();
        }
    }, 5000);

    function bodyCallback(
        mutationList: MutationRecord[],
    ){
        for (const mutation of mutationList) {
            if (mutation.type === "childList") {
                if(mutation.addedNodes.length>0){
                    mutation.addedNodes.forEach((node)=>{
                        const htmlNode = node as HTMLElement
                        const modalElems = htmlNode.querySelectorAll('[data-animate-modal-body="true"]');
                        if(modalElems.length>0){
                            window.setTimeout(()=>{
                                listenModalChanges();
    
                                logsTracker.addHistoryLog({
                                    label: "Iniciando extração...",
                                    category: LogCategory.LOG
                                })
                            }, 10)
                        }
                    })
                }
                if(mutation.removedNodes.length>0){
                    mutation.removedNodes.forEach((node)=>{
                        const htmlNode = node as HTMLElement
                        const modalElems = htmlNode.querySelectorAll('[data-animate-modal-body="true"]');
                        if(modalElems.length>0){
                            stopListeningModalChanges();
                            logsTracker.addHistoryLog({
                                label: "Extração pausada",
                                category: LogCategory.LOG
                            })
                        }
                    })
                }
            }
        }
    }
    
    const bodyConfig = { attributes: true, childList: true, subtree: true };
    const bodyObserver = new MutationObserver(bodyCallback);
    
    const app = document.getElementById('app');
    if(app){
        bodyObserver.observe(app, bodyConfig);
    }    
}

main();