const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Lê o script compilado
const scraperScript = fs.readFileSync(path.join(__dirname, 'dist/main.min.js'), 'utf8');

async function testWhatsAppScraper() {
    console.log('🚀 Iniciando teste do WhatsApp Scraper com Puppeteer...');
    
    // Configurações do browser
    const browser = await puppeteer.launch({
        headless: false, // Mostra o browser para visualizar o teste
        defaultViewport: { width: 1280, height: 720 },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });

    const page = await browser.newPage();
    
    // Intercepta logs do console
    page.on('console', msg => {
        if (msg.type() === 'log') {
            console.log('📱 WhatsApp:', msg.text());
        }
    });

    try {
        console.log('📂 Navegando para WhatsApp Web...');
        await page.goto('https://web.whatsapp.com', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        console.log('⏳ Aguardando carregamento da página...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verifica se precisa fazer login
        try {
            await page.waitForSelector('canvas[aria-label*="QR"]', { timeout: 5000 });
            console.log('🔐 QR Code detectado! Você tem 60 segundos para escanear...');
            
            // Aguarda login (espera o QR sumir ou o app carregar)
            await page.waitForFunction(() => {
                // Verifica se o QR sumiu OU se o app principal carregou
                const qr = document.querySelector('canvas[aria-label*="QR"]');
                const app = document.querySelector('#app div[data-testid]');
                return !qr || app;
            }, { timeout: 60000 });
            
            console.log('✅ Login realizado com sucesso!');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
        } catch (error) {
            console.log('🎯 WhatsApp já logado ou carregando...');
        }

        // Aguarda interface principal carregar
        console.log('⏳ Aguardando interface principal...');
        await page.waitForSelector('#app', { timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('💉 Injetando script do scraper...');
        
        // Injeta o script scraper
        await page.evaluate(scraperScript);
        
        console.log('✅ Script injetado com sucesso!');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verifica se a interface foi criada
        const interfaceVisible = await page.evaluate(() => {
            // Procura pelos elementos do scraper de forma mais robusta
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
            console.log('🎉 Interface do scraper detectada!');
        } else {
            console.log('⚠️  Interface não detectada, mas script foi injetado');
        }

        // Instrução para uso manual
        console.log(`
🎯 PRÓXIMOS PASSOS PARA TESTE:

1. ✅ Script foi injetado com sucesso
2. 🔍 Procure pelos botões flutuantes "Download 0 users" e "Reset" na tela
3. 📱 Clique em um grupo do WhatsApp
4. 👥 Clique na foto do grupo → "Dados do grupo" → "Ver todos"
5. 📜 Role LENTAMENTE no modal de membros
6. 📊 Observe o contador aumentar
7. 📥 Clique em "Download X users" para baixar o CSV

⏰ O browser ficará aberto para você testar manualmente...
Pressione Ctrl+C para encerrar quando terminar.
        `);

        // Mantém o browser aberto para teste manual
        await new Promise(resolve => {
            process.on('SIGINT', () => {
                console.log('\n👋 Encerrando teste...');
                resolve();
            });
        });

    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
    } finally {
        await browser.close();
        console.log('🔚 Browser fechado. Teste finalizado.');
    }
}

// Função para teste automatizado (se possível)
async function autoTest() {
    console.log('🤖 Tentativa de teste automatizado...');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 720 }
    });

    const page = await browser.newPage();
    
    try {
        // Vai para uma página de teste HTML simples
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Teste WhatsApp Scraper</title>
            </head>
            <body>
                <div id="app">
                    <h1>Teste do WhatsApp Scraper</h1>
                    <div>Injetando script...</div>
                </div>
            </body>
            </html>
        `);

        console.log('💉 Injetando script em página de teste...');
        await page.evaluate(scraperScript);
        
        // Verifica se alguma função foi criada
        const scriptLoaded = await page.evaluate(() => {
            return typeof window.memberListStore !== 'undefined' || 
                   typeof window.buildCTABtns !== 'undefined';
        });

        if (scriptLoaded) {
            console.log('✅ Script carregado com sucesso na página de teste!');
        } else {
            console.log('⚠️  Script pode ter carregado, mas funções não detectadas');
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
        
    } catch (error) {
        console.error('❌ Erro no teste automatizado:', error.message);
    } finally {
        await browser.close();
    }
}

// Executa o teste
if (process.argv.includes('--auto')) {
    autoTest();
} else {
    testWhatsAppScraper();
}