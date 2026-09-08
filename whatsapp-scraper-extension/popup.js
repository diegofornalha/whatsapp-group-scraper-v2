// Popup script simplificado
document.addEventListener('DOMContentLoaded', function() {
  const openButton = document.getElementById('openWhatsApp');
  
  // Botão para abrir WhatsApp
  openButton.addEventListener('click', function() {
    chrome.tabs.query({url: 'https://web.whatsapp.com/*'}, function(tabs) {
      if (tabs.length > 0) {
        // Se já tem aba, apenas foca nela
        chrome.tabs.update(tabs[0].id, {active: true});
        chrome.windows.update(tabs[0].windowId, {focused: true});
      } else {
        // Se não tem, cria nova aba
        chrome.tabs.create({url: 'https://web.whatsapp.com'});
      }
      window.close();
    });
  });
});