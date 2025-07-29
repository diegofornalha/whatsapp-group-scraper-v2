/**
 * UI Service for WhatsApp Group Scraper with enhanced interface
 */

import { BaseService } from '../core/BaseService';
import { EventBus } from '../core/EventBus';
import { ILogger } from '../types/ILogger';
import { IStorage } from '../types/IStorage';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { ConfigService } from '../core/ConfigService';
import { ServiceStatus } from '../types/IService';
import {
    UIContainer,
    createCta,
    createSpacer,
    createTextSpan,
    HistoryTracker,
    LogCategory,
    exportToCsv
} from 'browser-scraping-utils';

export class UIService extends BaseService {
    private uiContainer: UIContainer;
    private historyTracker!: HistoryTracker;
    private updateInterval?: number;
    private counterId = 'scraper-number-tracker';
    private performanceId = 'scraper-performance';

    constructor(
        eventBus: EventBus,
        logger: ILogger,
        private storage: IStorage,
        private metricsCollector: MetricsCollector,
        private config: ConfigService
    ) {
        super('UIService', eventBus, logger);
        this.uiContainer = new UIContainer();
    }

    async render(): Promise<void> {
        try {
            this.buildUI();
            this.uiContainer.render();
            
            // Start real-time updates
            this.startUpdates();
            
            this.logger.info('UI rendered successfully');
            this.eventBus.emit('ui:rendered', {});

        } catch (error) {
            this.logger.error('Failed to render UI', error as Error);
            throw error;
        }
    }

    private buildUI(): void {
        // History Tracker
        this.historyTracker = new HistoryTracker({
            onDelete: async (groupId: string) => {
                this.logger.info('Deleting group data', { groupId });
                // Implement group deletion if needed
                await this.updateCounter();
            },
            divContainer: this.uiContainer.history,
            maxLogs: 6 // Increased for better visibility
        });

        // Enhanced Download Button
        const btnDownload = createCta();
        btnDownload.appendChild(createTextSpan('📥 Download\u00A0'));
        btnDownload.appendChild(createTextSpan('0', {
            bold: true,
            idAttribute: this.counterId
        }));
        btnDownload.appendChild(createTextSpan('\u00A0members'));

        btnDownload.addEventListener('click', async () => {
            await this.handleExport();
        });

        this.uiContainer.addCta(btnDownload);

        // JSON Export Button
        const btnJsonExport = createCta();
        btnJsonExport.appendChild(createTextSpan('📋 Export JSON'));
        btnJsonExport.addEventListener('click', async () => {
            await this.handleExport('json');
        });

        this.uiContainer.addCta(btnJsonExport);

        // Spacer
        this.uiContainer.addCta(createSpacer());

        // Performance Metrics Display
        const performanceDisplay = createCta();
        performanceDisplay.appendChild(createTextSpan('⚡ ', {
            idAttribute: this.performanceId
        }));
        performanceDisplay.appendChild(createTextSpan('0/min'));
        performanceDisplay.style.cursor = 'default';
        
        this.uiContainer.addCta(performanceDisplay);

        // Spacer
        this.uiContainer.addCta(createSpacer());

        // Reset Button
        const btnReset = createCta();
        btnReset.appendChild(createTextSpan('🔄 Reset'));
        btnReset.addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset all data?')) {
                await this.handleReset();
            }
        });

        this.uiContainer.addCta(btnReset);

        // Settings Button
        const btnSettings = createCta();
        btnSettings.appendChild(createTextSpan('⚙️ Settings'));
        btnSettings.addEventListener('click', () => {
            this.showSettings();
        });

        this.uiContainer.addCta(btnSettings);

        // Make draggable
        this.uiContainer.makeItDraggable();

        // Add custom styles for enhanced UI
        this.applyEnhancedStyles();
    }

    private async handleExport(format: 'csv' | 'json' = 'csv'): Promise<void> {
        try {
            this.historyTracker.addHistoryLog({
                label: `Exporting data as ${format.toUpperCase()}...`,
                category: LogCategory.LOG
            });

            const exportData = await this.storage.exportData(format);
            
            if (format === 'json') {
                // Create blob and download for JSON
                const blob = new Blob([exportData.data], { 
                    type: 'application/json' 
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `whatsapp-export-${new Date().toISOString()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }

            this.historyTracker.addHistoryLog({
                label: `Exported ${exportData.metadata.totalMembers} members`,
                category: LogCategory.SUCCESS
            });

            this.metricsCollector.incrementCounter('exports.success', 1);

        } catch (error) {
            this.logger.error('Export failed', error as Error);
            this.historyTracker.addHistoryLog({
                label: 'Export failed',
                category: LogCategory.ERROR
            });
            this.metricsCollector.incrementCounter('exports.failed', 1);
        }
    }

    private async handleReset(): Promise<void> {
        try {
            await this.storage.clear();
            this.historyTracker.cleanLogs();
            await this.updateCounter();
            
            this.historyTracker.addHistoryLog({
                label: 'All data reset',
                category: LogCategory.SUCCESS
            });

            this.metricsCollector.incrementCounter('resets', 1);

        } catch (error) {
            this.logger.error('Reset failed', error as Error);
            this.historyTracker.addHistoryLog({
                label: 'Reset failed',
                category: LogCategory.ERROR
            });
        }
    }

    private showSettings(): void {
        // Placeholder for settings modal
        this.historyTracker.addHistoryLog({
            label: 'Settings coming soon',
            category: LogCategory.LOG
        });
    }

    private async updateCounter(): Promise<void> {
        const tracker = document.getElementById(this.counterId);
        if (tracker) {
            const stats = await this.storage.getStats();
            tracker.textContent = stats.totalMembers.toString();
        }
    }

    private async updatePerformance(): Promise<void> {
        const display = document.getElementById(this.performanceId);
        if (display) {
            const rate = this.metricsCollector.getMetric('members.extracted.rate') || 0;
            display.textContent = `⚡ ${Math.round(rate * 60)}/min`;
        }
    }

    private startUpdates(): void {
        // Initial update
        this.updateCounter();
        this.updatePerformance();

        // Real-time updates
        this.updateInterval = window.setInterval(() => {
            this.updateCounter();
            this.updatePerformance();
        }, 1000);

        // Listen to events
        this.eventBus.on('storage:member:added', () => {
            this.updateCounter();
        });

        this.eventBus.on('extraction:started', () => {
            this.historyTracker.addHistoryLog({
                label: 'Extraction started - Scroll to capture',
                category: LogCategory.LOG
            });
        });

        this.eventBus.on('extraction:stopped', (data: { extractedCount: number }) => {
            this.historyTracker.addHistoryLog({
                label: `Extracted ${data.extractedCount} members`,
                category: LogCategory.SUCCESS
            });
        });
    }

    private applyEnhancedStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .scraper-ui-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                padding: 16px;
                transition: all 0.3s ease;
            }
            
            .scraper-ui-container:hover {
                box-shadow: 0 6px 30px rgba(0, 0, 0, 0.15);
            }
            
            .scraper-cta {
                background: #128C7E;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
            }
            
            .scraper-cta:hover {
                background: #075E54;
                transform: translateY(-1px);
            }
            
            .scraper-history {
                max-height: 150px;
                overflow-y: auto;
                margin-top: 12px;
                padding: 8px;
                background: rgba(0, 0, 0, 0.03);
                border-radius: 8px;
            }
            
            .scraper-history::-webkit-scrollbar {
                width: 6px;
            }
            
            .scraper-history::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.05);
                border-radius: 3px;
            }
            
            .scraper-history::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('UI service initialized');
    }

    protected async onStart(): Promise<void> {
        this.status = ServiceStatus.RUNNING;
        this.logger.info('UI service started');
    }

    protected async onStop(): Promise<void> {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.logger.info('UI service stopped');
    }

    protected async onDispose(): Promise<void> {
        // Clean up UI elements if needed
        this.logger.info('UI service disposed');
    }
}