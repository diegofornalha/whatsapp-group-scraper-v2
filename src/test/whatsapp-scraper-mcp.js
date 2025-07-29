#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Script integrado para executar o WhatsApp Scraper usando MCP Server
 * 
 * Este script:
 * 1. Compila o servidor MCP se necessário
 * 2. Inicia o servidor MCP com Puppeteer
 * 3. Navega para WhatsApp Web
 * 4. Injeta o script do scraper
 * 5. Permite interação manual para teste
 */

class WhatsAppScraperMCP {
    constructor() {
        this.scraperScript = fs.readFileSync(
            path.join(__dirname, 'dist/main.min.js'), 
            'utf8'
        );
        this.mcpPath = path.join(__dirname, 'mcp-run-ts-tools');
    }

    async buildMCPServer() {
        console.log('📦 Verificando build do servidor MCP...');
        
        const buildPath = path.join(this.mcpPath, 'build');
        if (!fs.existsSync(buildPath)) {
            console.log('🔨 Compilando servidor MCP...');
            
            return new Promise((resolve, reject) => {
                const build = spawn('npm', ['run', 'build'], {
                    cwd: this.mcpPath,
                    shell: true
                });

                build.stdout.on('data', (data) => {
                    process.stdout.write(`Build: ${data}`);
                });

                build.stderr.on('data', (data) => {
                    process.stderr.write(`Build Error: ${data}`);
                });

                build.on('close', (code) => {
                    if (code === 0) {
                        console.log('✅ Servidor MCP compilado!\n');
                        resolve();
                    } else {
                        reject(new Error('Falha ao compilar servidor MCP'));
                    }
                });
            });
        } else {
            console.log('✅ Build do servidor MCP já existe\n');
        }
    }

    async startMCPServer() {
        console.log('🚀 Iniciando servidor MCP com Puppeteer...\n');
        
        const server = spawn('node', ['build/basic-server.js'], {
            cwd: this.mcpPath,
            stdio: 'pipe'
        });

        server.stdout.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Server started')) {
                console.log('✅ Servidor MCP iniciado com sucesso!\n');
            }
            console.log(`MCP: ${msg}`);
        });

        server.stderr.on('data', (data) => {
            console.error(`MCP Error: ${data}`);
        });

        server.on('error', (error) => {
            console.error('❌ Erro ao iniciar servidor MCP:', error);
        });

        return server;
    }

    /**
     * Cria um script Python para interagir com o servidor MCP
     */
    createPythonClient() {
        const pythonScript = `
import json
import sys
import subprocess

# Script Python para enviar comandos ao servidor MCP

def send_mcp_command(tool_name, args):
    """Envia um comando para o servidor MCP"""
    command = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": args
        },
        "id": 1
    }
    
    # Envia comando via stdin
    proc = subprocess.Popen(
        ['node', 'build/basic-server.js'],
        cwd='mcp-run-ts-tools',
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    output, error = proc.communicate(json.dumps(command))
    return output, error

# Comandos para executar o scraper
print("🌐 Navegando para WhatsApp Web...")
output, error = send_mcp_command("puppeteer_navigate", {"url": "https://web.whatsapp.com"})
print(f"Resultado: {output}")

print("\\n💉 Para injetar o script do scraper, execute no console do Puppeteer:")
print("await page.evaluate(() => { /* cole o script aqui */ })")
`;

        const scriptPath = path.join(__dirname, 'mcp-client.py');
        fs.writeFileSync(scriptPath, pythonScript);
        console.log(`📝 Script Python criado em: ${scriptPath}`);
        return scriptPath;
    }

    /**
     * Cria instruções detalhadas para uso
     */
    showInstructions() {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 INSTRUÇÕES PARA EXECUTAR O WHATSAPP SCRAPER COM MCP');
        console.log('='.repeat(60) + '\n');

        console.log('📋 OPÇÃO 1: Usar o servidor MCP diretamente\n');
        console.log('1. O servidor MCP está rodando com Puppeteer');
        console.log('2. Use um cliente MCP (Claude, Python, etc) para enviar comandos:');
        console.log('   - puppeteer_navigate para ir ao WhatsApp Web');
        console.log('   - Aguarde o QR code e faça login');
        console.log('   - Use puppeteer_get_content para verificar se carregou');
        console.log('   - Injete o script do scraper via console do Puppeteer\n');

        console.log('📋 OPÇÃO 2: Usar o Puppeteer diretamente\n');
        console.log('1. Execute: npm run test');
        console.log('2. O Chromium abrirá automaticamente');
        console.log('3. O script será injetado automaticamente');
        console.log('4. Siga as instruções na tela\n');

        console.log('📋 OPÇÃO 3: Copiar e colar manualmente\n');
        console.log('1. Abra https://web.whatsapp.com no Chrome');
        console.log('2. Abra o console (F12)');
        console.log('3. Cole o conteúdo de dist/main.min.js');
        console.log('4. Use a interface do scraper\n');

        console.log('🔧 FERRAMENTAS MCP DISPONÍVEIS:');
        console.log('- puppeteer_navigate: Navegar para URL');
        console.log('- puppeteer_screenshot: Capturar screenshot');
        console.log('- puppeteer_click: Clicar em elemento');
        console.log('- puppeteer_type: Digitar texto');
        console.log('- puppeteer_get_content: Obter HTML da página');
        console.log('- browser_open_url: Abrir URL no browser padrão\n');

        console.log('⚠️  IMPORTANTE:');
        console.log('- Use apenas em grupos próprios com consentimento');
        console.log('- O scraper salva dados localmente no IndexedDB');
        console.log('- Role devagar no modal de membros para capturar dados\n');

        console.log('📝 Script do scraper salvo em: dist/main.min.js');
        console.log('🔗 Servidor MCP rodando em: mcp-run-ts-tools/\n');
    }

    async run() {
        try {
            console.log('🚀 WhatsApp Scraper MCP Integration\n');
            
            // Compila o servidor MCP se necessário
            await this.buildMCPServer();
            
            // Inicia o servidor MCP
            const server = await this.startMCPServer();
            
            // Aguarda servidor iniciar
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Mostra instruções
            this.showInstructions();
            
            // Cria script Python auxiliar
            this.createPythonClient();
            
            console.log('⏰ Servidor MCP rodando. Pressione Ctrl+C para encerrar.\n');
            
            // Mantém rodando
            process.on('SIGINT', () => {
                console.log('\n👋 Encerrando...');
                server.kill();
                process.exit();
            });
            
        } catch (error) {
            console.error('❌ Erro:', error.message);
            process.exit(1);
        }
    }
}

// Executa
const scraper = new WhatsAppScraperMCP();
scraper.run();