# =� Diretrizes do Projeto WhatsApp Scraper Extension

## � AVISOS CR�TICOS

### =4 CONFORMIDADE LEGAL � OBRIGAT�RIA
- **NUNCA** implementar funcionalidades que violem os Termos de Servi�o do WhatsApp
- **SEMPRE** verificar conformidade com LGPD/GDPR antes de coletar dados
- **OBRIGAT�RIO** obter consentimento expl�cito dos usu�rios antes de qualquer coleta
- **PROIBIDO** fazer scraping automatizado sem usar APIs oficiais

### =� SEGURAN�A EM PRIMEIRO LUGAR
- **NUNCA** usar `innerHTML` sem sanitiza��o - usar manipula��o DOM segura
- **SEMPRE** implementar Content Security Policy (CSP) no manifest.json
- **NUNCA** armazenar dados sens�veis sem criptografia
- **SEMPRE** validar e sanitizar todas as entradas de dados
- **PROIBIDO** usar z-index m�ximo (2147483647) - usar valores razo�veis

## =� ARQUITETURA E PADR�ES

### Estrutura de C�digo
- **USAR** m�dulos ES6 para organiza��o do c�digo
- **IMPLEMENTAR** padr�o de separa��o de responsabilidades (SoC)
- **EVITAR** acoplamento forte com DOM de terceiros
- **CRIAR** abstra��es para seletores DOM em arquivo de configura��o centralizado

### Performance
- **SUBSTITUIR** polling por MutationObserver otimizado
- **IMPLEMENTAR** debounce em opera��es repetitivas (m�nimo 50ms)
- **EVITAR** seletores DOM complexos baseados em estilos inline
- **LIMITAR** uso de setTimeout/setInterval - preferir observers reativos
- **OTIMIZAR** queries DOM - cachear elementos quando poss�vel

### Tratamento de Erros
```javascript
// PADR�O OBRIGAT�RIO para tratamento de erros
try {
  // opera��o
} catch (error) {
  // 1. Log detalhado para debug
  console.error(`[Context]: ${error.message}`, error);
  
  // 2. Notifica��o amig�vel ao usu�rio
  showUserNotification(getUserFriendlyMessage(error));
  
  // 3. Tentativa de recupera��o quando poss�vel
  attemptRecovery(error, context);
  
  // 4. Fallback seguro
  return safeDefaultValue;
}
```

## =' PR�TICAS DE DESENVOLVIMENTO

### Antes de Implementar Qualquer Feature
1.  Verificar se n�o viola ToS do WhatsApp
2.  Verificar se existe API oficial para a funcionalidade
3.  Avaliar impacto na privacidade dos usu�rios
4.  Planejar tratamento de erros e casos extremos
5.  Considerar performance e uso de recursos

### Code Review Checklist
- [ ] C�digo n�o viola termos de servi�o de nenhuma plataforma
- [ ] Todos os dados sens�veis est�o protegidos
- [ ] N�o h� uso de innerHTML sem sanitiza��o
- [ ] CSP est� configurado corretamente
- [ ] Erros s�o tratados adequadamente
- [ ] Performance foi considerada (sem polling desnecess�rio)
- [ ] C�digo est� modularizado e test�vel
- [ ] Documenta��o est� atualizada

### Testes Obrigat�rios
```javascript
// M�NIMO de testes requeridos para cada m�dulo
describe('Module', () => {
  test('should handle normal operation', () => {});
  test('should handle errors gracefully', () => {});
  test('should not leak memory', () => {});
  test('should respect user privacy', () => {});
  test('should work with different DOM structures', () => {});
});
```

## =� PR�TICAS PROIBIDAS

1. **NUNCA** fazer scraping sem consentimento do usu�rio
2. **NUNCA** coletar dados al�m do necess�rio
3. **NUNCA** usar polling quando observer patterns s�o poss�veis
4. **NUNCA** assumir estrutura DOM fixa de sites terceiros
5. **NUNCA** ignorar erros - sempre ter fallback
6. **NUNCA** commitar credenciais ou tokens
7. **NUNCA** usar vari�veis globais desnecessariamente
8. **NUNCA** deixar console.logs em produ��o

##  ALTERNATIVAS RECOMENDADAS

### Em vez de Scraping Direto
-  WhatsApp Business API
-  Integra��o oficial com webhooks
-  Exporta��o manual com consentimento
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

## =� M�TRICAS DE QUALIDADE

### Performance
- Tempo de resposta < 100ms para intera��es do usu�rio
- Uso de CPU < 5% em idle
- Uso de mem�ria < 50MB
- Zero memory leaks

### Seguran�a
- 0 vulnerabilidades conhecidas
- CSP implementado e testado
- Todas entradas sanitizadas
- Dados sens�veis criptografados

### C�digo
- Cobertura de testes > 80%
- Complexidade ciclom�tica < 10
- Sem c�digo morto ou comentado
- JSDoc em todas fun��es p�blicas

## = PROCESSO DE DESENVOLVIMENTO

### 1. Planejamento
- Verificar viabilidade legal
- Definir requisitos de seguran�a
- Planejar arquitetura modular

### 2. Implementa��o
- Seguir padr�es definidos neste documento
- Implementar com testes desde o in�cio
- Code review obrigat�rio

### 3. Valida��o
- Testes automatizados passando
- Auditoria de seguran�a
- Verifica��o de performance
- Conformidade legal confirmada

### 4. Deploy
- Apenas ap�s todas valida��es
- Com documenta��o atualizada
- Com avisos legais claros ao usu�rio

## =� DOCUMENTA��O OBRIGAT�RIA

Cada m�dulo deve incluir:
```javascript
/**
 * @module ModuleName
 * @description Descri��o clara do prop�sito
 * @security Considera��es de seguran�a
 * @privacy Impacto na privacidade
 * @performance Caracter�sticas de performance
 * @legal Conformidade com ToS e leis
 */
```

## =� PROCEDIMENTO PARA ISSUES CR�TICAS

Se identificar viola��o de ToS ou problema de seguran�a:
1. **PARAR** desenvolvimento imediatamente
2. **DOCUMENTAR** o problema encontrado
3. **NOTIFICAR** stakeholders
4. **AVALIAR** alternativas legais
5. **PIVOTAR** ou descontinuar se necess�rio

## =� PRINC�PIOS FUNDAMENTAIS

1. **Legalidade acima de funcionalidade**
2. **Privacidade do usu�rio � inviol�vel**
3. **Seguran�a n�o � negoci�vel**
4. **Performance importa para UX**
5. **C�digo limpo � c�digo mant�vel**
6. **Testes s�o parte do c�digo**
7. **Documenta��o � obrigat�ria**

---

**LEMBRETE FINAL**: Este projeto deve priorizar conformidade legal e �tica. Se uma funcionalidade n�o pode ser implementada legalmente, ela N�O deve ser implementada. Considere sempre alternativas oficiais e aprovadas.