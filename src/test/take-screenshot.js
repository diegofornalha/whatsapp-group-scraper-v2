const puppeteer = require('puppeteer');

async function takeScreenshot() {
    console.log('📸 Conectando ao Chrome para tirar screenshot...');
    
    try {
        // Conecta ao Chrome que já está rodando
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222',
            defaultViewport: null
        });
        
        const pages = await browser.pages();
        
        // Procura pela página do WhatsApp
        let whatsappPage = null;
        for (const page of pages) {
            const url = page.url();
            if (url.includes('web.whatsapp.com')) {
                whatsappPage = page;
                break;
            }
        }
        
        if (!whatsappPage) {
            console.log('❌ Página do WhatsApp não encontrada');
            console.log('📱 Páginas abertas:');
            for (const page of pages) {
                console.log('  -', await page.title(), '|', page.url());
            }
            return;
        }
        
        console.log('✅ Página do WhatsApp encontrada!');
        console.log('📱 Título:', await whatsappPage.title());
        
        // Tira screenshot
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `whatsapp-scraper-screenshot-${timestamp}.png`;
        
        await whatsappPage.screenshot({
            path: filename,
            fullPage: true
        });
        
        console.log(`✅ Screenshot salvo como: ${filename}`);
        
        // Não fecha o browser - só desconecta
        browser.disconnect();
        
    } catch (error) {
        console.error('❌ Erro ao tirar screenshot:', error.message);
        console.log('\n💡 SOLUÇÃO ALTERNATIVA:');
        console.log('1. Aperte Cmd+Shift+4 (Mac) para screenshot manual');
        console.log('2. Ou use Cmd+Shift+3 para tela inteira');
    }
}

takeScreenshot();