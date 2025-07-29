const fs = require('fs');
const path = require('path');

// Lê o script compilado
const scraperScript = fs.readFileSync(path.join(__dirname, 'dist/main.min.js'), 'utf8');

console.log(`
🦁 BRAVE BROWSER - INJEÇÃO MANUAL DO SCRIPT

📋 PASSOS PARA USAR O BRAVE QUE JÁ ESTÁ ABERTO:

1. 🌐 Vá para o Brave que já tem WhatsApp Web logado
2. 🛠️ Abra o Developer Tools:
   - Pressione F12 OU
   - Cmd+Option+I (Mac) OU  
   - Clique com botão direito → "Inspecionar elemento"

3. 📝 Vá para a aba "Console" no DevTools

4. 📋 COPIE E COLE o script abaixo no console:

============================================
SCRIPT PARA COPIAR/COLAR NO BRAVE CONSOLE:
============================================

${scraperScript}

============================================

5. ✅ Pressione ENTER para executar

6. 🔍 Você verá os botões "Download 0 users" e "Reset" aparecerem

7. 🏃‍♂️ Agora é só usar o scraper normalmente:
   - Clique em um grupo
   - "Dados do grupo" → "Ver todos"  
   - Role lentamente no modal de membros
   - Baixe os dados com "Download X users"

🛡️ VANTAGENS DE USAR O BRAVE JÁ LOGADO:
- ✅ Não precisa fazer login novamente
- ✅ Mantém suas configurações
- ✅ Usa a sessão existente
- ✅ Mais rápido que abrir nova instância

💡 DICA: Salve este script como bookmark no Brave para usar sempre!
`);

// Opcional: salva o script em um arquivo .txt para facilitar
const scriptForCopy = `// WhatsApp Scraper Script para Brave Browser\n${scraperScript}`;

fs.writeFileSync(
    path.join(__dirname, 'script-para-brave-console.txt'), 
    scriptForCopy
);

console.log('\n📄 Script também salvo em: script-para-brave-console.txt');
console.log('📋 Você pode abrir esse arquivo e copiar o conteúdo para o console do Brave');