const puppeteer = require('puppeteer');
const fs = require('fs');

// Caminhos dos browsers no macOS
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROMIUM_PATH = '/Applications/Chromium.app/Contents/MacOS/Chromium';
const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

async function detectBrowsers() {
    console.log('🔍 DETECÇÃO DE BROWSERS DISPONÍVEIS\n');
    
    const browsers = [
        {
            name: 'Google Chrome',
            path: CHROME_PATH,
            description: '🌐 Browser comercial do Google com sincronização',
            features: ['Sync Google', 'Extensions Store', 'Auto-updates', 'Proprietary codecs']
        },
        {
            name: 'Chromium',
            path: CHROMIUM_PATH,
            description: '🔓 Browser open-source base do Chrome',
            features: ['Open source', 'No Google sync', 'Manual updates', 'Limited codecs']
        },
        {
            name: 'Brave Browser',
            path: BRAVE_PATH,
            description: '🛡️ Browser focado em privacidade',
            features: ['Built-in AdBlock', 'Privacy shields', 'Crypto rewards', 'Anti-tracking']
        }
    ];
    
    const availableBrowsers = [];
    
    for (const browser of browsers) {
        const exists = fs.existsSync(browser.path);
        console.log(`${exists ? '✅' : '❌'} ${browser.name}`);
        console.log(`   📍 ${browser.path}`);
        console.log(`   📝 ${browser.description}`);
        console.log(`   🔧 Features: ${browser.features.join(', ')}`);
        
        if (exists) {
            availableBrowsers.push(browser);
            
            // Testa qual está funcionando
            try {
                const testBrowser = await puppeteer.launch({
                    executablePath: browser.path,
                    headless: true,
                    args: ['--no-sandbox']
                });
                
                const page = await testBrowser.newPage();
                
                // Verifica user agent e propriedades específicas
                const info = await page.evaluate(() => ({
                    userAgent: navigator.userAgent,
                    vendor: navigator.vendor,
                    chrome: !!window.chrome,
                    webkitSpeechRecognition: !!window.webkitSpeechRecognition
                }));
                
                await testBrowser.close();
                
                console.log(`   🧬 User Agent: ${info.userAgent.substring(0, 80)}...`);
                console.log(`   🏢 Vendor: ${info.vendor}`);
                console.log(`   ⚡ Status: Funcionando perfeitamente\n`);
                
            } catch (error) {
                console.log(`   ❌ Erro: ${error.message}\n`);
            }
        } else {
            console.log(`   💭 Não instalado\n`);
        }
    }
    
    return availableBrowsers;
}

async function testWhatsAppScraperWithBrowser(browserPath, browserName) {
    console.log(`\n🧪 TESTANDO WHATSAPP SCRAPER COM ${browserName.toUpperCase()}`);
    console.log('=' .repeat(60));
    
    try {
        const browser = await puppeteer.launch({
            executablePath: browserPath,
            headless: false,
            defaultViewport: { width: 1280, height: 720 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        
        const page = await browser.newPage();
        
        // Adiciona identificação na página
        await page.evaluateOnNewDocument((browserName) => {
            console.log(`🚀 Executando em: ${browserName}`);
            window.BROWSER_TYPE = browserName;
        }, browserName);
        
        console.log(`📂 Abrindo WhatsApp Web com ${browserName}...`);
        await page.goto('https://web.whatsapp.com', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Verifica se carregou
        const title = await page.title();
        console.log(`✅ Página carregada: ${title}`);
        
        // Aguarda 3 segundos para o usuário ver
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await browser.close();
        console.log(`✅ Teste com ${browserName} concluído com sucesso!`);
        
    } catch (error) {
        console.error(`❌ Erro com ${browserName}:`, error.message);
    }
}

async function main() {
    const availableBrowsers = await detectBrowsers();
    
    console.log('\n📊 RESUMO:');
    console.log(`💻 Total de browsers detectados: ${availableBrowsers.length}`);
    
    if (availableBrowsers.length > 0) {
        console.log('\n🎯 DIFERENÇAS PRINCIPAIS:');
        console.log('');
        console.log('🌐 GOOGLE CHROME:');
        console.log('   • Browser comercial completo');
        console.log('   • Sincronização com conta Google');
        console.log('   • Codecs proprietários (H.264, AAC)');
        console.log('   • Updates automáticos');
        console.log('   • Melhor compatibilidade com sites');
        console.log('');
        console.log('🔓 CHROMIUM:');
        console.log('   • Versão open-source sem recursos Google');
        console.log('   • Sem sincronização de dados');
        console.log('   • Codecs limitados (apenas open-source)');
        console.log('   • Updates manuais');
        console.log('   • Pode ter problemas com alguns vídeos/áudios');
        console.log('');
        console.log('🛡️ BRAVE:');
        console.log('   • Bloqueio nativo de anúncios e trackers');
        console.log('   • Foco extremo em privacidade');
        console.log('   • Sistema de recompensas em criptomoedas');
        console.log('   • Baseado no Chromium');
        
        console.log('\n💡 PARA WHATSAPP SCRAPING:');
        console.log('🥇 Melhor: Google Chrome (máxima compatibilidade)');
        console.log('🥈 Alternativa: Brave (boa privacidade)');
        console.log('🥉 Funcional: Chromium (pode ter limitações)');
        
        // Permite testar cada browser
        if (process.argv.includes('--test-all')) {
            console.log('\n🧪 INICIANDO TESTES...');
            for (const browser of availableBrowsers) {
                await testWhatsAppScraperWithBrowser(browser.path, browser.name);
                console.log('\n' + '=' .repeat(60));
            }
        }
    } else {
        console.log('❌ Nenhum browser Chromium encontrado!');
        console.log('📥 Instale pelo menos um:');
        console.log('   • Chrome: https://www.google.com/chrome/');
        console.log('   • Chromium: https://www.chromium.org/');
        console.log('   • Brave: https://brave.com/');
    }
}

main();