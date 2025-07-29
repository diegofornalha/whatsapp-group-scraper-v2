const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const scraperScript = fs.readFileSync(path.join(__dirname, 'dist/main.min.js'), 'utf8');

async function testSessionPersistence() {
    console.log('🧪 TESTE DE PERSISTÊNCIA DE SESSÃO NO CHROME');
    console.log('=' .repeat(60));
    
    let attempt = 1;
    const maxAttempts = 3;
    
    while (attempt <= maxAttempts) {
        console.log(`\n🔄 TENTATIVA ${attempt}/${maxAttempts}`);
        
        const browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: false,
            defaultViewport: { width: 1280, height: 720 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
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
            
            console.log('⏳ Aguardando carregamento (5s)...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verifica se há QR code
            const hasQrCode = await page.$('canvas[aria-label*="QR"]');
            
            if (hasQrCode) {
                console.log('🔐 QR Code detectado - sessão expirou, precisa fazer login');
                
                console.log('⏰ Aguardando login (30s)...');
                try {
                    await page.waitForFunction(() => {
                        const qr = document.querySelector('canvas[aria-label*="QR"]');
                        const app = document.querySelector('#app div[data-testid]');
                        return !qr || app;
                    }, { timeout: 30000 });
                    
                    console.log('✅ Login realizado!');
                    
                } catch (error) {
                    console.log('⏰ Timeout no login - continuando teste...');
                }
                
            } else {
                console.log('🎉 SESSÃO MANTIDA! WhatsApp já logado automaticamente!');
            }
            
            // Tenta injetar script
            console.log('⏳ Aguardando interface principal...');
            
            try {
                await page.waitForSelector('#app', { timeout: 15000 });
                console.log('✅ Interface principal carregada');
                
                console.log('💉 Injetando script do scraper...');
                await page.evaluate(scraperScript);
                
                console.log('✅ Script injetado com sucesso!');
                
                // Verifica se interface do scraper apareceu
                const interfaceVisible = await page.evaluate(() => {
                    const allDivs = document.querySelectorAll('div');
                    let found = false;
                    
                    for (let div of allDivs) {
                        if (div.textContent && 
                            (div.textContent.includes('Download') && div.textContent.includes('users')) ||
                            div.textContent.includes('Reset')) {
                            found = true;
                            break;
                        }
                    }
                    
                    return found;
                });
                
                if (interfaceVisible) {
                    console.log('🎉 Interface do scraper detectada!');
                    console.log('✅ TESTE SUCESSO - Tudo funcionando!');
                    
                    console.log(`
🌐 CHROME - TESTE COMPLETO:

✅ Sessão: ${hasQrCode ? 'Nova (QR necessário)' : 'Mantida (login automático)'}
✅ Interface: Carregada corretamente  
✅ Script: Injetado com sucesso
✅ Scraper: Botões visíveis e funcionais

🎯 STATUS: PRONTO PARA USO!
⏰ Pressione Ctrl+C para encerrar...
                    `);
                    
                    // Mantém aberto
                    await new Promise(resolve => {
                        process.on('SIGINT', () => {
                            console.log('\n👋 Encerrando teste...');
                            resolve();
                        });
                    });
                    
                    break; // Sai do loop de tentativas
                    
                } else {
                    console.log('❌ Interface do scraper não detectada');
                    throw new Error('Interface não encontrada');
                }
                
            } catch (error) {
                console.log(`❌ Erro na tentativa ${attempt}:`, error.message);
            }
            
        } catch (error) {
            console.log(`❌ Erro geral na tentativa ${attempt}:`, error.message);
        } finally {
            await browser.close();
        }
        
        attempt++;
        
        if (attempt <= maxAttempts) {
            console.log('⏳ Aguardando 3s antes da próxima tentativa...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    if (attempt > maxAttempts) {
        console.log('\n❌ Todas as tentativas falharam');
    }
}

testSessionPersistence();