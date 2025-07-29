import {
    exportToCsv,
    ListStorage,
    UIContainer,
    createCta,
    createSpacer,
    createTextSpan,
    HistoryTracker,
    LogCategory
} from 'browser-scraping-utils';

// Nova importação para MCP
import { MCPBrowserClient } from './mcp-browser-client';

interface WhatsAppMember {
    profileId: string
    name?: string
    description?: string
    phoneNumber?: string
    source?: string
}

/**
 * Versão do WhatsApp Scraper integrada com MCP
 * Oferece armazenamento distribuído, analytics em tempo real e sincronização
 */
class WhatsAppScraperMCP {
    private uiWidget: UIContainer;
    private logsTracker: HistoryTracker;
    private mcpStorage: MCPBrowserClient;
    private mcpAnalytics: MCPBrowserClient;
    private sessionId: string;
    private syncInterval: NodeJS.Timer;

    constructor() {
        this.uiWidget = new UIContainer();
        this.sessionId = this.generateSessionId();
        
        // Inicializar clientes MCP
        this.mcpStorage = new MCPBrowserClient({
            server: 'whatsapp-storage',
            endpoint: process.env.MCP_STORAGE_URL || 'wss://mcp-storage.example.com'
        });
        
        this.mcpAnalytics = new MCPBrowserClient({
            server: 'whatsapp-analytics',
            endpoint: process.env.MCP_ANALYTICS_URL || 'wss://mcp-analytics.example.com'
        });
        
        this.initialize();
    }

    private async initialize() {
        // Conectar aos servidores MCP
        await Promise.all([
            this.mcpStorage.connect(),
            this.mcpAnalytics.connect()
        ]);
        
        // Configurar UI
        this.buildUI();
        
        // Iniciar sincronização automática
        this.startAutoSync();
        
        // Carregar dados existentes
        await this.loadExistingData();
        
        // Configurar observadores
        this.setupObservers();
    }

    private async saveMember(member: WhatsAppMember) {
        try {
            // Salvar no MCP Storage com criptografia
            const storageResult = await this.mcpStorage.call('store_member', {
                member,
                sessionId: this.sessionId,
                ttl: 30 * 24 * 60 * 60 // 30 dias
            });
            
            // Processar com Analytics
            const analyticsResult = await this.mcpAnalytics.call('process_member', {
                member,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString()
            });
            
            // Atualizar UI com insights
            if (analyticsResult.insights.isDuplicate) {
                this.logsTracker.addHistoryLog({
                    label: `Duplicata detectada: ${member.name}`,
                    category: LogCategory.WARNING
                });
            }
            
            // Mostrar padrões detectados
            if (analyticsResult.patterns.length > 0) {
                const patterns = analyticsResult.patterns.map(p => p.type).join(', ');
                this.logsTracker.addHistoryLog({
                    label: `Padrões: ${patterns}`,
                    category: LogCategory.INFO
                });
            }
            
            // Atualizar contador
            await this.updateCounter();
            
            // Notificar sucesso
            this.showNotification('✅ Membro salvo na nuvem', 'success');
            
        } catch (error) {
            console.error('Erro ao salvar membro:', error);
            this.showNotification('❌ Erro ao salvar', 'error');
            
            // Fallback para storage local
            await this.saveToLocalStorage(member);
        }
    }

    private async updateCounter() {
        try {
            // Obter contagem do servidor
            const searchResult = await this.mcpStorage.call('search_members', {
                filters: { sessionId: this.sessionId },
                limit: 0 // Apenas contagem
            });
            
            const tracker = document.getElementById('scraper-number-tracker');
            if (tracker) {
                tracker.textContent = searchResult.total.toString();
            }
            
            // Atualizar analytics dashboard
            await this.updateAnalyticsDashboard();
            
        } catch (error) {
            console.error('Erro ao atualizar contador:', error);
        }
    }

    private async updateAnalyticsDashboard() {
        try {
            const dashboardData = await this.mcpAnalytics.call('get_dashboard_data', {
                timeframe: '24h',
                metrics: ['growth', 'engagement', 'patterns']
            });
            
            // Atualizar elementos do dashboard
            this.updateGrowthChart(dashboardData.charts.memberGrowth);
            this.updatePatternStats(dashboardData.metrics.patterns);
            
        } catch (error) {
            console.error('Erro ao atualizar dashboard:', error);
        }
    }

    private buildUI() {
        // History Tracker com integração MCP
        this.logsTracker = new HistoryTracker({
            onDelete: async (groupId: string) => {
                try {
                    // Deletar do servidor MCP
                    await this.mcpStorage.call('delete_group', {
                        groupId,
                        sessionId: this.sessionId
                    });
                    
                    await this.updateCounter();
                    this.showNotification('✅ Grupo removido', 'success');
                    
                } catch (error) {
                    console.error('Erro ao deletar grupo:', error);
                    this.showNotification('❌ Erro ao remover', 'error');
                }
            },
            divContainer: this.uiWidget.history,
            maxLogs: 6 // Mais logs com MCP
        });

        // Botão Download com opções avançadas
        const btnDownload = createCta();
        btnDownload.appendChild(createTextSpan('Download\u00A0'));
        btnDownload.appendChild(createTextSpan('0', {
            bold: true,
            idAttribute: 'scraper-number-tracker'
        }));
        btnDownload.appendChild(createTextSpan('\u00A0users'));

        btnDownload.addEventListener('click', async () => {
            await this.showDownloadOptions();
        });

        this.uiWidget.addCta(btnDownload);

        // Botão Analytics
        const btnAnalytics = createCta();
        btnAnalytics.appendChild(createTextSpan('📊 Analytics'));
        btnAnalytics.addEventListener('click', async () => {
            await this.showAnalytics();
        });
        
        this.uiWidget.addCta(btnAnalytics);

        // Botão Sync Status
        const btnSync = createCta();
        btnSync.appendChild(createTextSpan('🔄 Sync: '));
        btnSync.appendChild(createTextSpan('Online', {
            idAttribute: 'sync-status',
            bold: true
        }));
        
        this.uiWidget.addCta(btnSync);

        // Spacer
        this.uiWidget.addCta(createSpacer());

        // Botão Configurações
        const btnSettings = createCta();
        btnSettings.appendChild(createTextSpan('⚙️ Config'));
        btnSettings.addEventListener('click', () => {
            this.showSettings();
        });
        
        this.uiWidget.addCta(btnSettings);

        // Tornar arrastável
        this.uiWidget.makeItDraggable();

        // Renderizar
        this.uiWidget.render();

        // Adicionar dashboard analytics
        this.addAnalyticsDashboard();
    }

    private async showDownloadOptions() {
        const modal = this.createModal('Opções de Download');
        
        const options = [
            { format: 'csv', label: 'CSV (Excel)', icon: '📊' },
            { format: 'json', label: 'JSON', icon: '📄' },
            { format: 'encrypted', label: 'Backup Criptografado', icon: '🔒' }
        ];
        
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'download-option';
            btn.innerHTML = `${opt.icon} ${opt.label}`;
            btn.onclick = async () => {
                await this.downloadData(opt.format);
                modal.remove();
            };
            modal.appendChild(btn);
        });
        
        document.body.appendChild(modal);
    }

    private async downloadData(format: string) {
        try {
            this.showNotification('⏳ Preparando download...', 'info');
            
            // Criar backup no servidor
            const backup = await this.mcpStorage.call('create_backup', {
                sessionId: this.sessionId,
                format
            });
            
            // Baixar arquivo
            const timestamp = new Date().toISOString();
            const filename = `whatsapp-export-${timestamp}.${format}`;
            
            // Obter URL de download do servidor
            const downloadUrl = await this.mcpStorage.call('get_download_url', {
                backupId: backup.backupId
            });
            
            // Iniciar download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            a.click();
            
            this.showNotification('✅ Download iniciado', 'success');
            
        } catch (error) {
            console.error('Erro no download:', error);
            this.showNotification('❌ Erro no download', 'error');
        }
    }

    private async showAnalytics() {
        try {
            // Obter dados do analytics
            const analytics = await this.mcpAnalytics.call('get_dashboard_data', {
                timeframe: '7d',
                metrics: ['growth', 'engagement', 'patterns', 'predictions']
            });
            
            // Criar modal com dashboard
            const modal = this.createModal('📊 Analytics Dashboard');
            modal.className = 'analytics-modal';
            
            // Adicionar gráficos e métricas
            modal.innerHTML = `
                <div class="analytics-grid">
                    <div class="metric-card">
                        <h3>Crescimento</h3>
                        <div class="metric-value">${analytics.metrics.growth.rate}%</div>
                        <div class="metric-chart" id="growth-chart"></div>
                    </div>
                    <div class="metric-card">
                        <h3>Padrões Detectados</h3>
                        <div class="pattern-list">
                            ${analytics.metrics.patterns.map(p => 
                                `<div class="pattern-item">${p.name}: ${p.count}</div>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="metric-card">
                        <h3>Previsões (7 dias)</h3>
                        <div class="predictions">
                            ${analytics.metrics.predictions.map(p => 
                                `<div>+${p.expected} membros (${p.confidence}% confiança)</div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Renderizar gráficos
            this.renderCharts(analytics.charts);
            
        } catch (error) {
            console.error('Erro ao mostrar analytics:', error);
            this.showNotification('❌ Erro ao carregar analytics', 'error');
        }
    }

    private startAutoSync() {
        // Sincronizar a cada 30 segundos
        this.syncInterval = setInterval(async () => {
            try {
                const syncResult = await this.mcpStorage.call('sync_data', {
                    deviceId: this.getDeviceId(),
                    lastSync: this.getLastSyncTime()
                });
                
                // Atualizar status de sync
                const statusEl = document.getElementById('sync-status');
                if (statusEl) {
                    statusEl.textContent = 'Online';
                    statusEl.className = 'sync-online';
                }
                
                // Processar mudanças
                if (syncResult.changes.length > 0) {
                    await this.processServerChanges(syncResult.changes);
                }
                
            } catch (error) {
                console.error('Erro na sincronização:', error);
                const statusEl = document.getElementById('sync-status');
                if (statusEl) {
                    statusEl.textContent = 'Offline';
                    statusEl.className = 'sync-offline';
                }
            }
        }, 30000);
    }

    private setupObservers() {
        // Implementação similar ao original, mas chamando saveMember()
        // ao invés de salvar localmente
        
        // ... código do observer ...
    }

    // Métodos auxiliares
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getDeviceId(): string {
        let deviceId = localStorage.getItem('whatsapp_scraper_device_id');
        if (!deviceId) {
            deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('whatsapp_scraper_device_id', deviceId);
        }
        return deviceId;
    }

    private getLastSyncTime(): string {
        return localStorage.getItem('whatsapp_scraper_last_sync') || new Date(0).toISOString();
    }

    private showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning') {
        // Implementar sistema de notificações
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

    private createModal(title: string): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'mcp-modal';
        modal.innerHTML = `
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
            <div class="modal-content"></div>
        `;
        return modal;
    }
}

// Inicializar
new WhatsAppScraperMCP();