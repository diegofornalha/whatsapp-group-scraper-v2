const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Lê o script compilado
const scraperScript = fs.readFileSync(path.join(__dirname, 'dist/main.min.js'), 'utf8');

// Configurações dos browsers
const BROWSERS = {
    chrome: {
        name: 'Google Chrome',
        path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        icon: '🌐'
    },
    chromium: {
        name: 'Chromium',
        path: '/Applications/Chromium.app/Contents/MacOS/Chromium',
        icon: '🔓'
    },
    brave: {
        name: 'Brave Browser',
        path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        icon: '🛡️'
    }
};

async function testSpecificBrowser(browserType) {
    const browser = BROWSERS[browserType];
    
    if (!browser) {
        console.error('❌ Tipo de browser inválido. Use: chrome, chromium, ou brave');
        return;
    }
    
    if (!fs.existsSync(browser.path)) {
        console.error(`❌ ${browser.name} não encontrado em: ${browser.path}`);
        return;
    }
    
    console.log(`${browser.icon} INICIANDO WHATSAPP SCRAPER COM ${browser.name.toUpperCase()}`);
    console.log('='.repeat(70));
    
    // Configurações específicas por browser  
    let launchOptions = {
        executablePath: browser.path,
        headless: false,
        defaultViewport: { width: 1280, height: 720 },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    };
    
    // Ajustes específicos
    if (browserType === 'brave') {
        launchOptions.args.push(
            '--disable-brave-features',
            '--disable-extensions-except'
        );
    } else if (browserType === 'chromium') {
        launchOptions.args.push(
            '--disable-features=VizDisplayCompositor'
        );
    }
    
    const puppeteerBrowser = await puppeteer.launch(launchOptions);
    const page = await puppeteerBrowser.newPage();
    
    // Adiciona identificação do browser na página
    await page.evaluateOnNewDocument((browserInfo) => {
        window.BROWSER_INFO = browserInfo;
        console.log(`🚀 WhatsApp Scraper executando em: ${browserInfo.name}`);
    }, browser);
    
    // Intercepta logs do console
    page.on('console', msg => {
        if (msg.type() === 'log') {
            console.log(`${browser.icon} WhatsApp:`, msg.text());
        }
    });
    
    try {
        console.log(`📂 Navegando para WhatsApp Web via ${browser.name}...`);
        await page.goto('https://web.whatsapp.com', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Detecta informações do browser na página
        const browserInfo = await page.evaluate(() => ({
            userAgent: navigator.userAgent,
            vendor: navigator.vendor,
            browserName: window.BROWSER_INFO ? window.BROWSER_INFO.name : 'Unknown',
            isChrome: !!window.chrome,
            isBrave: navigator.brave && navigator.brave.isBrave,
            webkitSpeechRecognition: !!window.webkitSpeechRecognition
        }));
        
        console.log(`${browser.icon} Informações detectadas:`);
        console.log(`   📱 Nome: ${browserInfo.browserName}`);
        console.log(`   🏢 Vendor: ${browserInfo.vendor}`);
        console.log(`   🧬 User Agent: ${browserInfo.userAgent.substring(0, 60)}...`);
        console.log(`   ⚙️ Chrome API: ${browserInfo.isChrome ? '✅' : '❌'}`);
        console.log(`   🛡️ Brave API: ${browserInfo.isBrave ? '✅' : '❌'}`);
        
        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verifica se precisa fazer login
        try {
            await page.waitForSelector('canvas[aria-label*="QR"]', { timeout: 5000 });
            console.log(`🔐 QR Code detectado no ${browser.name}! Você tem 60 segundos para escanear...`);
            
            await page.waitForFunction(() => {
                const qr = document.querySelector('canvas[aria-label*="QR"]');
                const app = document.querySelector('#app div[data-testid]');
                return !qr || app;
            }, { timeout: 60000 });
            
            console.log(`✅ Login realizado com sucesso no ${browser.name}!`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.log(`🎯 WhatsApp já logado no ${browser.name}`);
        }
        
        // Aguarda interface principal
        console.log('⏳ Aguardando interface principal...');
        await page.waitForSelector('#app', { timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`💉 Injetando script do scraper no ${browser.name}...`);
        await page.evaluate(scraperScript);
        
        console.log(`✅ Script injetado com sucesso no ${browser.name}!`);
        
        // Verifica se interface foi criada
        const interfaceVisible = await page.evaluate(() => {
            const allDivs = document.querySelectorAll('div');
            let downloadBtn = false;
            let resetBtn = false;
            
            for (let div of allDivs) {
                if (div.textContent && div.textContent.includes('Download') && div.textContent.includes('users')) {
                    downloadBtn = true;
                }
                if (div.textContent && div.textContent.includes('Reset')) {
                    resetBtn = true;
                }
            }
            
            return downloadBtn || resetBtn;
        });
        
        if (interfaceVisible) {
            console.log(`🎉 Interface do scraper detectada no ${browser.name}!`);
        } else {
            console.log(`⚠️ Interface não detectada no ${browser.name}`);
        }
        
        console.log(`
${browser.icon} ${browser.name.toUpperCase()} - PRÓXIMOS PASSOS:

1. ✅ Script injetado com sucesso
2. 🔍 Procure pelos botões "Download 0 users" e "Reset"
3. 📱 Clique em um grupo do WhatsApp
4. 👥 "Dados do grupo" → "Ver todos"
5. 📜 Role lentamente no modal de membros
6. 📥 Clique em "Download X users" para baixar

⏰ ${browser.name} ficará aberto para teste...
Pressione Ctrl+C para encerrar.
        `);
        
        // Mantém aberto
        await new Promise(resolve => {
            process.on('SIGINT', () => {
                console.log(`\n👋 Encerrando ${browser.name}...`);
                resolve();
            });
        });
        
    } catch (error) {
        console.error(`❌ Erro no ${browser.name}:`, error.message);
    } finally {
        await puppeteerBrowser.close();
        console.log(`🔚 ${browser.name} fechado.`);
    }
}

// Executa com o browser especificado
const browserType = process.argv[2];

if (!browserType) {
    console.log('🔧 USO: node test-specific-browser.js [chrome|chromium|brave]');
    console.log('');
    console.log('📖 EXEMPLOS:');
    console.log('   node test-specific-browser.js chrome    # Usa Google Chrome');
    console.log('   node test-specific-browser.js chromium  # Usa Chromium');  
    console.log('   node test-specific-browser.js brave     # Usa Brave Browser');
    process.exit(1);
}

testSpecificBrowser(browserType);