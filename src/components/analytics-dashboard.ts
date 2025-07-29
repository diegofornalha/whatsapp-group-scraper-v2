/**
 * Analytics Dashboard Component
 * Dashboard interativo com gráficos e métricas em tempo real
 */

import { Chart, registerables } from 'chart.js';
import { MCPBrowserClient } from '../mcp-browser-client';

Chart.register(...registerables);

export interface DashboardMetrics {
    totalMembers: number;
    growthRate: number;
    activeGroups: number;
    duplicateRate: number;
    patterns: Array<{
        name: string;
        count: number;
        percentage: number;
    }>;
    predictions: Array<{
        metric: string;
        expected: number;
        confidence: number;
    }>;
    timeline: Array<{
        date: string;
        members: number;
        groups: number;
    }>;
}

export class AnalyticsDashboard {
    private container: HTMLElement;
    private mcpClient: MCPBrowserClient;
    private charts: Map<string, Chart> = new Map();
    private updateInterval: NodeJS.Timer | null = null;
    private isMinimized: boolean = false;

    constructor(mcpClient: MCPBrowserClient) {
        this.mcpClient = mcpClient;
        this.container = this.createContainer();
        this.initialize();
    }

    private createContainer(): HTMLElement {
        const container = document.createElement('div');
        container.id = 'mcp-analytics-dashboard';
        container.className = 'mcp-dashboard';
        container.innerHTML = `
            <div class="dashboard-header">
                <h2>📊 Analytics Dashboard</h2>
                <div class="dashboard-controls">
                    <button class="btn-refresh" title="Atualizar">🔄</button>
                    <button class="btn-fullscreen" title="Tela cheia">🔳</button>
                    <button class="btn-minimize" title="Minimizar">➖</button>
                    <button class="btn-close" title="Fechar">✕</button>
                </div>
            </div>
            <div class="dashboard-tabs">
                <button class="tab-btn active" data-tab="overview">Visão Geral</button>
                <button class="tab-btn" data-tab="patterns">Padrões</button>
                <button class="tab-btn" data-tab="predictions">Previsões</button>
                <button class="tab-btn" data-tab="export">Exportar</button>
            </div>
            <div class="dashboard-content">
                <div class="tab-content active" id="tab-overview">
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-icon">👥</div>
                            <div class="metric-value" id="total-members">0</div>
                            <div class="metric-label">Total de Membros</div>
                            <div class="metric-change" id="members-change">+0%</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">📈</div>
                            <div class="metric-value" id="growth-rate">0%</div>
                            <div class="metric-label">Taxa de Crescimento</div>
                            <div class="metric-trend" id="growth-trend">→</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">👥</div>
                            <div class="metric-value" id="active-groups">0</div>
                            <div class="metric-label">Grupos Ativos</div>
                            <div class="metric-status">🟢</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">🔍</div>
                            <div class="metric-value" id="duplicate-rate">0%</div>
                            <div class="metric-label">Taxa de Duplicatas</div>
                            <div class="metric-quality">Ótimo</div>
                        </div>
                    </div>
                    <div class="charts-grid">
                        <div class="chart-container">
                            <h3>Crescimento de Membros</h3>
                            <canvas id="growth-chart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h3>Distribuição por Grupo</h3>
                            <canvas id="distribution-chart"></canvas>
                        </div>
                    </div>
                </div>
                <div class="tab-content" id="tab-patterns">
                    <div class="patterns-container">
                        <h3>Padrões Detectados</h3>
                        <div class="patterns-list" id="patterns-list"></div>
                        <div class="pattern-insights">
                            <h4>Insights</h4>
                            <div id="pattern-insights-content"></div>
                        </div>
                    </div>
                </div>
                <div class="tab-content" id="tab-predictions">
                    <div class="predictions-container">
                        <h3>Previsões (Próximos 7 dias)</h3>
                        <div class="predictions-grid" id="predictions-grid"></div>
                        <canvas id="predictions-chart"></canvas>
                    </div>
                </div>
                <div class="tab-content" id="tab-export">
                    <div class="export-container">
                        <h3>Exportar Dados</h3>
                        <div class="export-options">
                            <div class="export-option">
                                <h4>📊 Relatório Completo</h4>
                                <p>Exportar análise completa com gráficos</p>
                                <button class="btn-export" data-format="pdf">Exportar PDF</button>
                            </div>
                            <div class="export-option">
                                <h4>📈 Dados Brutos</h4>
                                <p>Exportar dados para análise externa</p>
                                <button class="btn-export" data-format="excel">Exportar Excel</button>
                            </div>
                            <div class="export-option">
                                <h4>🔗 API Integration</h4>
                                <p>Configurar webhook para envio automático</p>
                                <button class="btn-export" data-format="api">Configurar API</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="dashboard-footer">
                <span class="sync-status">🟢 Sincronizado</span>
                <span class="last-update">Última atualização: agora</span>
                <button class="btn-settings">⚙️ Configurações</button>
            </div>
        `;

        this.addStyles();
        return container;
    }

    private addStyles(): void {
        if (document.getElementById('mcp-dashboard-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'mcp-dashboard-styles';
        styles.textContent = `
            .mcp-dashboard {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 800px;
                max-width: 90vw;
                height: 600px;
                max-height: 80vh;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                transition: all 0.3s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .mcp-dashboard.minimized {
                height: 50px;
                width: 300px;
            }

            .mcp-dashboard.fullscreen {
                top: 0;
                right: 0;
                width: 100vw;
                height: 100vh;
                max-width: 100vw;
                max-height: 100vh;
                border-radius: 0;
            }

            .dashboard-header {
                padding: 16px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 12px 12px 0 0;
            }

            .dashboard-header h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
            }

            .dashboard-controls {
                display: flex;
                gap: 8px;
            }

            .dashboard-controls button {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .dashboard-controls button:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            .dashboard-tabs {
                display: flex;
                background: #f8f9fa;
                padding: 0;
                border-bottom: 1px solid #e9ecef;
            }

            .tab-btn {
                flex: 1;
                padding: 12px 16px;
                background: none;
                border: none;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                color: #6c757d;
                transition: all 0.2s;
                position: relative;
            }

            .tab-btn:hover {
                color: #495057;
                background: rgba(0, 0, 0, 0.02);
            }

            .tab-btn.active {
                color: #667eea;
                background: white;
            }

            .tab-btn.active::after {
                content: '';
                position: absolute;
                bottom: -1px;
                left: 0;
                right: 0;
                height: 2px;
                background: #667eea;
            }

            .dashboard-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: white;
            }

            .tab-content {
                display: none;
            }

            .tab-content.active {
                display: block;
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap: 16px;
                margin-bottom: 24px;
            }

            .metric-card {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 16px;
                text-align: center;
                transition: all 0.2s;
            }

            .metric-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .metric-icon {
                font-size: 24px;
                margin-bottom: 8px;
            }

            .metric-value {
                font-size: 28px;
                font-weight: 700;
                color: #212529;
                margin-bottom: 4px;
            }

            .metric-label {
                font-size: 12px;
                color: #6c757d;
                margin-bottom: 4px;
            }

            .metric-change {
                font-size: 12px;
                font-weight: 600;
                color: #28a745;
            }

            .metric-change.negative {
                color: #dc3545;
            }

            .charts-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
            }

            .chart-container {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 16px;
            }

            .chart-container h3 {
                margin: 0 0 12px 0;
                font-size: 16px;
                font-weight: 600;
                color: #212529;
            }

            .patterns-list {
                display: grid;
                gap: 12px;
                margin-bottom: 20px;
            }

            .pattern-item {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.2s;
            }

            .pattern-item:hover {
                background: #e9ecef;
            }

            .pattern-name {
                font-weight: 500;
                color: #212529;
            }

            .pattern-stats {
                display: flex;
                gap: 16px;
                align-items: center;
            }

            .pattern-count {
                font-size: 18px;
                font-weight: 700;
                color: #667eea;
            }

            .pattern-percentage {
                font-size: 14px;
                color: #6c757d;
            }

            .predictions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 24px;
            }

            .prediction-card {
                background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
                border-radius: 8px;
                padding: 16px;
                text-align: center;
            }

            .prediction-metric {
                font-size: 14px;
                color: #6c757d;
                margin-bottom: 8px;
            }

            .prediction-value {
                font-size: 24px;
                font-weight: 700;
                color: #667eea;
                margin-bottom: 4px;
            }

            .prediction-confidence {
                font-size: 12px;
                color: #6c757d;
            }

            .export-options {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }

            .export-option {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
            }

            .export-option h4 {
                margin: 0 0 8px 0;
                font-size: 18px;
            }

            .export-option p {
                margin: 0 0 16px 0;
                font-size: 14px;
                color: #6c757d;
            }

            .btn-export {
                background: #667eea;
                color: white;
                border: none;
                padding: 8px 24px;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .btn-export:hover {
                background: #5a67d8;
                transform: translateY(-1px);
            }

            .dashboard-footer {
                padding: 12px 20px;
                background: #f8f9fa;
                border-top: 1px solid #e9ecef;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 0 0 12px 12px;
                font-size: 12px;
                color: #6c757d;
            }

            .sync-status {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .btn-settings {
                background: none;
                border: 1px solid #dee2e6;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                color: #6c757d;
                transition: all 0.2s;
            }

            .btn-settings:hover {
                background: white;
                color: #495057;
                border-color: #adb5bd;
            }

            .minimized .dashboard-content,
            .minimized .dashboard-tabs,
            .minimized .dashboard-footer {
                display: none;
            }
        `;
        document.head.appendChild(styles);
    }

    private initialize(): void {
        document.body.appendChild(this.container);
        this.setupEventListeners();
        this.initializeCharts();
        this.startAutoUpdate();
    }

    private setupEventListeners(): void {
        // Controles do dashboard
        this.container.querySelector('.btn-close')?.addEventListener('click', () => this.close());
        this.container.querySelector('.btn-minimize')?.addEventListener('click', () => this.toggleMinimize());
        this.container.querySelector('.btn-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
        this.container.querySelector('.btn-refresh')?.addEventListener('click', () => this.refresh());

        // Tabs
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const tabId = target.dataset.tab;
                this.switchTab(tabId!);
            });
        });

        // Botões de exportação
        this.container.querySelectorAll('.btn-export').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const format = target.dataset.format;
                this.exportData(format!);
            });
        });

        // Configurações
        this.container.querySelector('.btn-settings')?.addEventListener('click', () => this.showSettings());

        // Tornar arrastável
        this.makeDraggable();
    }

    private makeDraggable(): void {
        const header = this.container.querySelector('.dashboard-header') as HTMLElement;
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.style.cursor = 'move';

        header.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).tagName === 'BUTTON') return;
            isDragging = true;
            offsetX = e.clientX - this.container.offsetLeft;
            offsetY = e.clientY - this.container.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            this.container.style.left = `${e.clientX - offsetX}px`;
            this.container.style.top = `${e.clientY - offsetY}px`;
            this.container.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    private initializeCharts(): void {
        // Gráfico de crescimento
        const growthCtx = this.container.querySelector('#growth-chart') as HTMLCanvasElement;
        if (growthCtx) {
            this.charts.set('growth', new Chart(growthCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Membros',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            }));
        }

        // Gráfico de distribuição
        const distributionCtx = this.container.querySelector('#distribution-chart') as HTMLCanvasElement;
        if (distributionCtx) {
            this.charts.set('distribution', new Chart(distributionCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#667eea',
                            '#764ba2',
                            '#f093fb',
                            '#4facfe',
                            '#00f2fe'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            }));
        }

        // Gráfico de previsões
        const predictionsCtx = this.container.querySelector('#predictions-chart') as HTMLCanvasElement;
        if (predictionsCtx) {
            this.charts.set('predictions', new Chart(predictionsCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Previsão',
                        data: [],
                        backgroundColor: 'rgba(102, 126, 234, 0.6)',
                        borderColor: '#667eea',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            }));
        }
    }

    private async refresh(): Promise<void> {
        try {
            const data = await this.mcpClient.call('get_dashboard_data', {
                timeframe: '7d',
                metrics: ['all']
            });

            this.updateMetrics(data.metrics);
            this.updateCharts(data.charts);
            this.updatePatterns(data.patterns);
            this.updatePredictions(data.predictions);

            // Atualizar timestamp
            const lastUpdate = this.container.querySelector('.last-update');
            if (lastUpdate) {
                lastUpdate.textContent = `Última atualização: ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            console.error('Erro ao atualizar dashboard:', error);
            this.showError('Erro ao carregar dados');
        }
    }

    private updateMetrics(metrics: any): void {
        // Atualizar valores
        this.updateElement('#total-members', metrics.totalMembers);
        this.updateElement('#growth-rate', `${metrics.growthRate}%`);
        this.updateElement('#active-groups', metrics.activeGroups);
        this.updateElement('#duplicate-rate', `${metrics.duplicateRate}%`);

        // Atualizar indicadores de mudança
        const changeElement = this.container.querySelector('#members-change');
        if (changeElement) {
            changeElement.textContent = metrics.membersChange > 0 ? `+${metrics.membersChange}%` : `${metrics.membersChange}%`;
            changeElement.className = metrics.membersChange >= 0 ? 'metric-change' : 'metric-change negative';
        }

        // Atualizar tendência
        const trendElement = this.container.querySelector('#growth-trend');
        if (trendElement) {
            trendElement.textContent = metrics.growthRate > 0 ? '↑' : metrics.growthRate < 0 ? '↓' : '→';
        }
    }

    private updateCharts(chartsData: any): void {
        // Atualizar gráfico de crescimento
        const growthChart = this.charts.get('growth');
        if (growthChart && chartsData.growth) {
            growthChart.data.labels = chartsData.growth.labels;
            growthChart.data.datasets[0].data = chartsData.growth.data;
            growthChart.update();
        }

        // Atualizar gráfico de distribuição
        const distributionChart = this.charts.get('distribution');
        if (distributionChart && chartsData.distribution) {
            distributionChart.data.labels = chartsData.distribution.labels;
            distributionChart.data.datasets[0].data = chartsData.distribution.data;
            distributionChart.update();
        }
    }

    private updatePatterns(patterns: any[]): void {
        const patternsList = this.container.querySelector('#patterns-list');
        if (!patternsList) return;

        patternsList.innerHTML = patterns.map(pattern => `
            <div class="pattern-item">
                <div class="pattern-info">
                    <div class="pattern-name">${pattern.name}</div>
                    <div class="pattern-description">${pattern.description || ''}</div>
                </div>
                <div class="pattern-stats">
                    <div class="pattern-count">${pattern.count}</div>
                    <div class="pattern-percentage">${pattern.percentage}%</div>
                </div>
            </div>
        `).join('');

        // Atualizar insights
        const insightsContent = this.container.querySelector('#pattern-insights-content');
        if (insightsContent && patterns.length > 0) {
            const topPattern = patterns[0];
            insightsContent.innerHTML = `
                <p>O padrão mais comum é <strong>${topPattern.name}</strong>, 
                representando ${topPattern.percentage}% dos membros.</p>
                ${patterns.length > 1 ? `<p>Foram detectados ${patterns.length} padrões diferentes no total.</p>` : ''}
            `;
        }
    }

    private updatePredictions(predictions: any[]): void {
        const predictionsGrid = this.container.querySelector('#predictions-grid');
        if (!predictionsGrid) return;

        predictionsGrid.innerHTML = predictions.map(pred => `
            <div class="prediction-card">
                <div class="prediction-metric">${pred.metric}</div>
                <div class="prediction-value">+${pred.expected}</div>
                <div class="prediction-confidence">
                    ${pred.confidence}% de confiança
                </div>
            </div>
        `).join('');

        // Atualizar gráfico de previsões
        const predictionsChart = this.charts.get('predictions');
        if (predictionsChart) {
            const next7Days = Array.from({ length: 7 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i + 1);
                return date.toLocaleDateString('pt-BR', { weekday: 'short' });
            });

            predictionsChart.data.labels = next7Days;
            predictionsChart.data.datasets[0].data = predictions.map(p => p.expected);
            predictionsChart.update();
        }
    }

    private updateElement(selector: string, value: any): void {
        const element = this.container.querySelector(selector);
        if (element) {
            element.textContent = value.toString();
        }
    }

    private switchTab(tabId: string): void {
        // Atualizar botões
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Atualizar conteúdo
        this.container.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
    }

    private async exportData(format: string): Promise<void> {
        try {
            const button = this.container.querySelector(`[data-format="${format}"]`) as HTMLButtonElement;
            if (button) {
                button.disabled = true;
                button.textContent = 'Exportando...';
            }

            const result = await this.mcpClient.call('export_analytics', {
                format,
                timeframe: '7d',
                includeCharts: true
            });

            if (result.downloadUrl) {
                window.open(result.downloadUrl, '_blank');
            } else if (format === 'api') {
                this.showApiConfig(result.apiConfig);
            }

            if (button) {
                button.disabled = false;
                button.textContent = format === 'pdf' ? 'Exportar PDF' : 
                                   format === 'excel' ? 'Exportar Excel' : 'Configurar API';
            }

        } catch (error) {
            console.error('Erro ao exportar:', error);
            this.showError('Erro ao exportar dados');
        }
    }

    private showApiConfig(config: any): void {
        // Implementar modal de configuração de API
        alert('Configuração de API: ' + JSON.stringify(config, null, 2));
    }

    private showSettings(): void {
        // Implementar modal de configurações
        alert('Configurações do Dashboard - Em desenvolvimento');
    }

    private showError(message: string): void {
        // Implementar notificação de erro
        console.error(message);
    }

    private toggleMinimize(): void {
        this.isMinimized = !this.isMinimized;
        this.container.classList.toggle('minimized', this.isMinimized);
    }

    private toggleFullscreen(): void {
        this.container.classList.toggle('fullscreen');
    }

    private startAutoUpdate(): void {
        // Atualizar a cada 30 segundos
        this.updateInterval = setInterval(() => {
            this.refresh();
        }, 30000);

        // Atualizar imediatamente
        this.refresh();
    }

    private close(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.container.remove();
    }

    public show(): void {
        this.container.style.display = 'flex';
        this.refresh();
    }

    public hide(): void {
        this.container.style.display = 'none';
    }
}

// Exportar função de conveniência
export function createAnalyticsDashboard(mcpClient: MCPBrowserClient): AnalyticsDashboard {
    return new AnalyticsDashboard(mcpClient);
}