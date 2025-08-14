# =Ë Diretrizes do Projeto WhatsApp Scraper Extension

##   AVISOS CRÍTICOS

### =4 CONFORMIDADE LEGAL É OBRIGATÓRIA
- **NUNCA** implementar funcionalidades que violem os Termos de Serviço do WhatsApp
- **SEMPRE** verificar conformidade com LGPD/GDPR antes de coletar dados
- **OBRIGATÓRIO** obter consentimento explícito dos usuários antes de qualquer coleta
- **PROIBIDO** fazer scraping automatizado sem usar APIs oficiais

### =á SEGURANÇA EM PRIMEIRO LUGAR
- **NUNCA** usar `innerHTML` sem sanitização - usar manipulação DOM segura
- **SEMPRE** implementar Content Security Policy (CSP) no manifest.json
- **NUNCA** armazenar dados sensíveis sem criptografia
- **SEMPRE** validar e sanitizar todas as entradas de dados
- **PROIBIDO** usar z-index máximo (2147483647) - usar valores razoáveis

## =Ð ARQUITETURA E PADRÕES

### Estrutura de Código
- **USAR** módulos ES6 para organização do código
- **IMPLEMENTAR** padrão de separação de responsabilidades (SoC)
- **EVITAR** acoplamento forte com DOM de terceiros
- **CRIAR** abstrações para seletores DOM em arquivo de configuração centralizado

### Performance
- **SUBSTITUIR** polling por MutationObserver otimizado
- **IMPLEMENTAR** debounce em operações repetitivas (mínimo 50ms)
- **EVITAR** seletores DOM complexos baseados em estilos inline
- **LIMITAR** uso de setTimeout/setInterval - preferir observers reativos
- **OTIMIZAR** queries DOM - cachear elementos quando possível

### Tratamento de Erros
```javascript
// PADRÃO OBRIGATÓRIO para tratamento de erros
try {
  // operação
} catch (error) {
  // 1. Log detalhado para debug
  console.error(`[Context]: ${error.message}`, error);
  
  // 2. Notificação amigável ao usuário
  showUserNotification(getUserFriendlyMessage(error));
  
  // 3. Tentativa de recuperação quando possível
  attemptRecovery(error, context);
  
  // 4. Fallback seguro
  return safeDefaultValue;
}
```

## =' PRÁTICAS DE DESENVOLVIMENTO

### Antes de Implementar Qualquer Feature
1.  Verificar se não viola ToS do WhatsApp
2.  Verificar se existe API oficial para a funcionalidade
3.  Avaliar impacto na privacidade dos usuários
4.  Planejar tratamento de erros e casos extremos
5.  Considerar performance e uso de recursos

### Code Review Checklist
- [ ] Código não viola termos de serviço de nenhuma plataforma
- [ ] Todos os dados sensíveis estão protegidos
- [ ] Não há uso de innerHTML sem sanitização
- [ ] CSP está configurado corretamente
- [ ] Erros são tratados adequadamente
- [ ] Performance foi considerada (sem polling desnecessário)
- [ ] Código está modularizado e testável
- [ ] Documentação está atualizada

### Testes Obrigatórios
```javascript
// MÍNIMO de testes requeridos para cada módulo
describe('Module', () => {
  test('should handle normal operation', () => {});
  test('should handle errors gracefully', () => {});
  test('should not leak memory', () => {});
  test('should respect user privacy', () => {});
  test('should work with different DOM structures', () => {});
});
```

## =« PRÁTICAS PROIBIDAS

1. **NUNCA** fazer scraping sem consentimento do usuário
2. **NUNCA** coletar dados além do necessário
3. **NUNCA** usar polling quando observer patterns são possíveis
4. **NUNCA** assumir estrutura DOM fixa de sites terceiros
5. **NUNCA** ignorar erros - sempre ter fallback
6. **NUNCA** commitar credenciais ou tokens
7. **NUNCA** usar variáveis globais desnecessariamente
8. **NUNCA** deixar console.logs em produção

##  ALTERNATIVAS RECOMENDADAS

### Em vez de Scraping Direto
-  WhatsApp Business API
-  Integração oficial com webhooks
-  Exportação manual com consentimento
-  Ferramentas aprovadas pela Meta

### Em vez de Polling
```javascript
// L EVITAR
setInterval(() => checkElement(), 1000);

//  PREFERIR
const observer = new MutationObserver(handleMutations);
observer.observe(target, { childList: true, subtree: true });
```

### Em vez de innerHTML
```javascript
// L EVITAR
element.innerHTML = `<div>${userContent}</div>`;

//  PREFERIR
const div = document.createElement('div');
div.textContent = userContent;
element.appendChild(div);
```

## =Ê MÉTRICAS DE QUALIDADE

### Performance
- Tempo de resposta < 100ms para interações do usuário
- Uso de CPU < 5% em idle
- Uso de memória < 50MB
- Zero memory leaks

### Segurança
- 0 vulnerabilidades conhecidas
- CSP implementado e testado
- Todas entradas sanitizadas
- Dados sensíveis criptografados

### Código
- Cobertura de testes > 80%
- Complexidade ciclomática < 10
- Sem código morto ou comentado
- JSDoc em todas funções públicas

## = PROCESSO DE DESENVOLVIMENTO

### 1. Planejamento
- Verificar viabilidade legal
- Definir requisitos de segurança
- Planejar arquitetura modular

### 2. Implementação
- Seguir padrões definidos neste documento
- Implementar com testes desde o início
- Code review obrigatório

### 3. Validação
- Testes automatizados passando
- Auditoria de segurança
- Verificação de performance
- Conformidade legal confirmada

### 4. Deploy
- Apenas após todas validações
- Com documentação atualizada
- Com avisos legais claros ao usuário

## =Ý DOCUMENTAÇÃO OBRIGATÓRIA

Cada módulo deve incluir:
```javascript
/**
 * @module ModuleName
 * @description Descrição clara do propósito
 * @security Considerações de segurança
 * @privacy Impacto na privacidade
 * @performance Características de performance
 * @legal Conformidade com ToS e leis
 */
```

## =¨ PROCEDIMENTO PARA ISSUES CRÍTICAS

Se identificar violação de ToS ou problema de segurança:
1. **PARAR** desenvolvimento imediatamente
2. **DOCUMENTAR** o problema encontrado
3. **NOTIFICAR** stakeholders
4. **AVALIAR** alternativas legais
5. **PIVOTAR** ou descontinuar se necessário

## =¡ PRINCÍPIOS FUNDAMENTAIS

1. **Legalidade acima de funcionalidade**
2. **Privacidade do usuário é inviolável**
3. **Segurança não é negociável**
4. **Performance importa para UX**
5. **Código limpo é código mantível**
6. **Testes são parte do código**
7. **Documentação é obrigatória**

---

**LEMBRETE FINAL**: Este projeto deve priorizar conformidade legal e ética. Se uma funcionalidade não pode ser implementada legalmente, ela NÃO deve ser implementada. Considere sempre alternativas oficiais e aprovadas.