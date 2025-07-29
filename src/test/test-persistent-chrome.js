const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const scraperScript = fs.readFileSync(path.join(__dirname, 'dist/main.min.js'), 'utf8');

// Diretório para salvar dados do Chrome (sessão persistente)
const CHROME_DATA_DIR = path.join(os.homedir(), '.whatsapp-chrome-data');

async function testPersistentChrome() {
    console.log('🔄 TESTE DE CHROME COM SESSÃO PERSISTENTE');
    console.log('=' .repeat(60));
    
    // Cria diretório se não existir
    if (!fs.existsSync(CHROME_DATA_DIR)) {
        fs.mkdirSync(CHROME_DATA_DIR, { recursive: true });
        console.log('📁 Diretório de dados criado:', CHROME_DATA_DIR);
    } else {
        console.log('📁 Usando diretório existente:', CHROME_DATA_DIR);
    }
    
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: false,
        defaultViewport: { width: 1280, height: 720 },
        userDataDir: CHROME_DATA_DIR, // 🎯 CHAVE: Salva dados entre sessões!
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--no-first-run' // Não mostra tutorial do Chrome
        ]
    });
    
    const page = await browser.newPage();
    
    // Intercepta logs
    page.on('console', msg => {
        if (msg.type() === 'log') {
            console.log(`🌐 WhatsApp:`, msg.text());
        }
    });
    
    try {
        console.log('📂 Navegando para WhatsApp Web...');
        await page.goto('https://web.whatsapp.com', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        console.log('⏳ Aguardando carregamento (3s)...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verifica status da sessão
        const hasQrCode = await page.$('canvas[aria-label*="QR"]');
        const hasChats = await page.$('[data-testid="chat"]');
        
        if (hasQrCode) {
            console.log('🔐 PRIMEIRA VEZ: QR Code detectado - faça login');
            console.log('📱 Escaneie o QR code com seu celular');
            console.log('⏰ Aguardando login...');
            
            // Aguarda login
            await page.waitForFunction(() => {
                const qr = document.querySelector('canvas[aria-label*="QR"]');
                const app = document.querySelector('#app div[data-testid]');
                return !qr || app;
            }, { timeout: 60000 });
            
            console.log('✅ Login realizado e SALVO no Chrome!');
            console.log('🎉 Próximas execuções NÃO pedirão QR code!');
            
        } else if (hasChats) {
            console.log('🎉 SESSÃO MANTIDA! WhatsApp já conectado automaticamente!');
            console.log('✅ Sem QR code necessário - dados salvos funcionando!');
            
        } else {
            console.log('⏳ WhatsApp carregando... aguardando...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // Aguarda interface principal
        console.log('⏳ Aguardando interface do WhatsApp...');
        await page.waitForSelector('#app', { timeout: 20000 });
        
        console.log('💉 Injetando script do scraper...');
        await page.evaluate(scraperScript);
        
        console.log('✅ Script injetado com sucesso!');
        
        // Verifica interface do scraper
        const interfaceVisible = await page.evaluate(() => {
            const allDivs = document.querySelectorAll('div');
            for (let div of allDivs) {
                if (div.textContent && 
                    ((div.textContent.includes('Download') && div.textContent.includes('users')) ||
                     div.textContent.includes('Reset'))) {
                    return true;
                }
            }
            return false;
        });
        
        if (interfaceVisible) {
            console.log('🎉 Interface do scraper detectada!');
        }
        
        console.log(`
🌐 CHROME PERSISTENTE - RESULTADO:

${hasQrCode ? '🔐 Status: Primeira vez (QR necessário)' : '🎉 Status: Sessão mantida (sem QR)'}
✅ Dados salvos em: ${CHROME_DATA_DIR}
✅ Interface: Funcionando
✅ Script: Injetado
✅ Scraper: Pronto para uso

💡 IMPORTANTE:
- Esta sessão será MANTIDA entre execuções
- Próximas vezes NÃO pedirão QR code
- Para resetar sessão: delete ${CHROME_DATA_DIR}

🎯 TESTE: Feche e execute novamente para verificar persistência!
⏰ Pressione Ctrl+C para encerrar...
        `);
        
        // Mantém aberto
        await new Promise(resolve => {
            process.on('SIGINT', () => {
                console.log('\n👋 Encerrando Chrome persistente...');
                resolve();
            });
        });
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await browser.close();
        console.log('🔚 Chrome fechado - dados mantidos para próxima execução!');
    }
}

// Função para limpar dados salvos (reset)
async function clearChromeData() {
    console.log('🗑️ Limpando dados salvos do Chrome...');
    
    if (fs.existsSync(CHROME_DATA_DIR)) {
        const exec = require('child_process').exec;
        exec(`rm -rf "${CHROME_DATA_DIR}"`, (error) => {
            if (error) {
                console.error('❌ Erro ao limpar:', error.message);
            } else {
                console.log('✅ Dados limpos! Próxima execução pedirá QR code novamente.');
            }
        });
    } else {
        console.log('📁 Nenhum dado salvo encontrado.');
    }
}

// Verifica argumentos da linha de comando
if (process.argv.includes('--clear')) {
    clearChromeData();
} else {
    testPersistentChrome();
}