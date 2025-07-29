const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Lê o script do scraper
const scraperScript = fs.readFileSync(path.join(__dirname, 'dist/main.min.js'), 'utf8');

/**
 * Testa o WhatsApp Scraper usando o servidor MCP
 */
async function testWithMCP() {
    console.log('🚀 Iniciando teste do WhatsApp Scraper com MCP Server...\n');
    
    // Primeiro, vamos compilar o servidor MCP
    console.log('📦 Compilando servidor MCP...');
    const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: path.join(__dirname, 'mcp-run-ts-tools'),
        shell: true
    });

    buildProcess.stdout.on('data', (data) => {
        console.log(`Build: ${data}`);
    });

    buildProcess.stderr.on('data', (data) => {
        console.error(`Build Error: ${data}`);
    });

    await new Promise((resolve) => {
        buildProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Servidor MCP compilado com sucesso!\n');
            }
            resolve();
        });
    });

    // Agora vamos executar o servidor MCP
    console.log('🔧 Iniciando servidor MCP...');
    const mcpServer = spawn('node', ['build/execute-tool.js'], {
        cwd: path.join(__dirname, 'mcp-run-ts-tools'),
        shell: true
    });

    mcpServer.stdout.on('data', (data) => {
        console.log(`MCP: ${data}`);
    });

    mcpServer.stderr.on('data', (data) => {
        console.error(`MCP Error: ${data}`);
    });

    // Aguarda o servidor iniciar
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📋 Instruções para teste com MCP:\n');
    console.log('1. O servidor MCP está rodando');
    console.log('2. Use as seguintes ferramentas disponíveis:');
    console.log('   - puppeteer_navigate: Para navegar até o WhatsApp Web');
    console.log('   - puppeteer_type: Para inserir texto');
    console.log('   - puppeteer_click: Para clicar em elementos');
    console.log('   - puppeteer_screenshot: Para capturar screenshots');
    console.log('   - puppeteer_get_content: Para obter o HTML da página\n');
    
    console.log('3. Exemplo de comandos para executar o scraper:');
    console.log('   a) Navegue para WhatsApp Web:');
    console.log('      puppeteer_navigate({ "url": "https://web.whatsapp.com" })');
    console.log('   b) Aguarde o login e injete o script');
    console.log('   c) Interaja com a interface do scraper\n');

    console.log('4. Para injetar o script manualmente no console do Puppeteer:');
    console.log('   Execute: page.evaluate(`' + scraperScript.substring(0, 50) + '...`)\n');

    console.log('⏰ Servidor MCP rodando. Pressione Ctrl+C para encerrar.\n');

    // Mantém o processo rodando
    process.on('SIGINT', () => {
        console.log('\n👋 Encerrando servidor MCP...');
        mcpServer.kill();
        process.exit();
    });
}

// Script alternativo para usar diretamente o execute-tool
async function directMCPTest() {
    console.log('🎯 Teste direto com execute-tool.js\n');
    
    const executeToolPath = path.join(__dirname, 'mcp-run-ts-tools/build/execute-tool.js');
    
    // Cria um arquivo de comando para testar
    const testCommands = {
        tool: 'puppeteer_navigate',
        args: {
            url: 'https://web.whatsapp.com'
        }
    };

    console.log('📝 Executando comando:', JSON.stringify(testCommands, null, 2));
    
    // Salva o comando em um arquivo temporário
    const tempFile = path.join(__dirname, 'temp-command.json');
    fs.writeFileSync(tempFile, JSON.stringify(testCommands));
    
    // Executa o tool
    const executeProcess = spawn('node', [executeToolPath, tempFile], {
        cwd: path.join(__dirname, 'mcp-run-ts-tools'),
        shell: true
    });

    executeProcess.stdout.on('data', (data) => {
        console.log(`Output: ${data}`);
    });

    executeProcess.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
    });

    executeProcess.on('close', (code) => {
        console.log(`\nProcesso finalizado com código: ${code}`);
        // Remove arquivo temporário
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    });
}

// Verifica qual modo executar
if (process.argv.includes('--direct')) {
    directMCPTest();
} else {
    testWithMCP();
}