const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Usa o script já compilado que funciona
const scraperScript = fs.readFileSync(path.join(__dirname, 'dist/main.min.js'), 'utf8');

async function runWhatsAppScraper() {
    console.log('🚀 Iniciando WhatsApp Scraper...\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ]
    });

    const page = await browser.newPage();
    
    // Monitora logs do console
    page.on('console', msg => {
        const text = msg.text();
        if (!text.includes('Extension server error') && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
            console.log('📱 Console:', text);
        }
    });

    page.on('pageerror', error => {
        console.error('❌ Erro na página:', error.message);
    });

    try {
        console.log('🌐 Abrindo WhatsApp Web...');
        await page.goto('https://web.whatsapp.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        console.log('⏳ Aguardando página carregar...\n');
        
        // Verifica se tem QR Code
        try {
            await page.waitForSelector('canvas', { timeout: 5000 });
            console.log('🔐 QR CODE DETECTADO!');
            console.log('📱 ESCANEIE O QR CODE COM SEU WHATSAPP!\n');
            console.log('⏰ Você tem 60 segundos...\n');
            
            // Aguarda o QR code desaparecer (login realizado)
            await page.waitForFunction(
                () => !document.querySelector('canvas'),
                { timeout: 60000 }
            );
            
            console.log('✅ Login realizado com sucesso!\n');
            
        } catch (e) {
            console.log('📱 WhatsApp já está logado ou carregando...\n');
        }

        // Aguarda interface carregar completamente
        console.log('⏳ Aguardando WhatsApp carregar completamente...');
        await page.waitForSelector('#app', { timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('💉 Injetando script do scraper...\n');
        
        // Injeta o script
        const result = await page.evaluate((script) => {
            try {
                eval(script);
                return { success: true, message: 'Script injetado com sucesso!' };
            } catch (error) {
                return { success: false, message: error.toString() };
            }
        }, scraperScript);

        if (result.success) {
            console.log('✅', result.message);
            console.log('🎉 Interface do scraper deve aparecer na tela!\n');
        } else {
            console.log('❌ Erro ao injetar:', result.message);
        }

        // Verifica se a interface foi criada
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const uiCreated = await page.evaluate(() => {
            const elements = document.querySelectorAll('div[style*="position: fixed"]');
            return elements.length > 0;
        });

        if (uiCreated) {
            console.log('✅ Interface do scraper detectada!\n');
        }

        console.log('📋 INSTRUÇÕES DE USO:\n');
        console.log('1. ✅ Script foi injetado com sucesso');
        console.log('2. 🔍 Procure pelos botões "Download 0 users" e "Reset" flutuando na tela');
        console.log('3. 📱 Entre em um grupo do WhatsApp');
        console.log('4. 👥 Clique na foto do grupo → "Dados do grupo" → "Ver todos"');
        console.log('5. 📜 Role LENTAMENTE no modal de membros para capturar dados');
        console.log('6. 📊 Observe o contador no botão aumentar');
        console.log('7. 📥 Clique em "Download X users" para baixar o arquivo CSV\n');

        console.log('🔄 Para versão seletiva (com dropdown de grupos):');
        console.log('   Execute: npm run build-selective');
        console.log('   Use o arquivo: dist/main-selective.min.js\n');

        console.log('⚡ DICAS:');
        console.log('- Role devagar (1-2 segundos por tela)');
        console.log('- Os dados são salvos automaticamente');
        console.log('- O botão Reset limpa todos os dados\n');

        console.log('⏰ Browser permanecerá aberto para você testar.');
        console.log('📌 Pressione Ctrl+C quando terminar.\n');

        // Mantém o browser aberto
        await new Promise((resolve) => {
            process.on('SIGINT', () => {
                console.log('\n👋 Encerrando...');
                resolve();
            });
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await browser.close();
        console.log('🔚 Teste finalizado.');
    }
}

// Executa
console.log('=' .repeat(60));
console.log('🎯 WHATSAPP GROUP MEMBERS SCRAPER - TESTE AO VIVO');
console.log('=' .repeat(60) + '\n');

runWhatsAppScraper().catch(console.error);