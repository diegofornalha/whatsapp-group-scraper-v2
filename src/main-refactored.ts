/**
 * WhatsApp Group Scraper - Refactored Main Entry Point
 * Integrates all new modular components with enhanced security and monitoring
 */

import { DIContainer, createDIContainer } from './core/di/Container';
import { TOKENS } from './core/di/tokens';
import { EventBus } from './core/EventBus';
import { ConfigService } from './core/ConfigService';
import { ServiceRegistry } from './core/ServiceRegistry';
import { Logger } from './monitoring/Logger';
import { MetricsCollector } from './monitoring/MetricsCollector';
import { PerformanceMonitor } from './monitoring/PerformanceMonitor';
import { SecurityManager } from './core/security/SecurityManager';
import { AuditLogger } from './core/security/AuditLogger';
import { bootstrapApplication } from './core/di/bootstrap';
import { IService } from './types/IService';
import { ILogger } from './types/ILogger';
import { IExtractor } from './types/IExtractor';
import { IStorage } from './types/IStorage';
import { Member, Group } from './types/models';
import { WhatsAppExtractorService } from './extractors/WhatsAppExtractorService';
import { WhatsAppStorageService } from './storage/WhatsAppStorageService';
import { UIService } from './ui/UIService';
import { 
    UIContainer,
    createCta,
    createSpacer,
    createTextSpan,
    HistoryTracker,
    LogCategory 
} from 'browser-scraping-utils';

/**
 * Application startup with full dependency injection and monitoring
 */
async function startApplication(): Promise<void> {
    let container: DIContainer;
    let serviceRegistry: ServiceRegistry;
    let logger: ILogger;

    try {
        // Bootstrap the application with all services
        const appContext = await bootstrapApplication();
        container = appContext.container;
        serviceRegistry = appContext.serviceRegistry;

        // Get logger instance
        logger = container.resolve<ILogger>(TOKENS.Logger);
        logger.info('WhatsApp Group Scraper - Starting application', {
            version: '2.0.0',
            environment: 'browser'
        });

        // Initialize all services
        await serviceRegistry.initializeAll();
        logger.info('All services initialized successfully');

        // Start all services
        await serviceRegistry.startAll();
        logger.info('All services started successfully');

        // Get main services
        const uiService = container.resolve<UIService>(TOKENS.UIService);
        const extractorService = container.resolve<IExtractor>(TOKENS.Extractor);
        const storageService = container.resolve<IStorage>(TOKENS.Storage);
        const metricsCollector = container.resolve<MetricsCollector>(TOKENS.MetricsCollector);
        const performanceMonitor = container.resolve<PerformanceMonitor>(TOKENS.PerformanceMonitor);
        const eventBus = container.resolve<EventBus>(TOKENS.EventBus);

        // Set up event handlers
        setupEventHandlers(eventBus, logger, metricsCollector);

        // Initialize UI
        await uiService.initialize();
        await uiService.render();

        // Start extraction monitoring
        startExtractionMonitoring(extractorService, logger, performanceMonitor);

        logger.info('Application started successfully', {
            servicesCount: serviceRegistry.getStatus().size,
            uiReady: true
        });

        // Track application start metrics
        metricsCollector.incrementCounter('app.starts', 1);

    } catch (error) {
        if (logger) {
            logger.error('Failed to start application', error as Error, {
                phase: 'startup'
            });
        } else {
            console.error('Failed to start application:', error);
        }
        throw error;
    }
}

/**
 * Set up global event handlers for monitoring and coordination
 */
function setupEventHandlers(
    eventBus: EventBus,
    logger: ILogger,
    metricsCollector: MetricsCollector
): void {
    // Monitor member extraction events
    eventBus.on('member:extracted', async (data: { member: Member; source: string }) => {
        logger.debug('Member extracted', {
            phoneNumber: data.member.phoneNumber,
            source: data.source
        });
        metricsCollector.incrementCounter('members.extracted', 1);
    });

    // Monitor storage events
    eventBus.on('storage:saved', async (data: { count: number }) => {
        logger.info('Members saved to storage', { count: data.count });
        metricsCollector.recordGauge('storage.members.total', data.count);
    });

    // Monitor security events
    eventBus.on('security:threat', async (data: { type: string; severity: string }) => {
        logger.warn('Security threat detected', {
            type: data.type,
            severity: data.severity
        });
        metricsCollector.incrementCounter(`security.threats.${data.type}`, 1);
    });

    // Monitor performance events
    eventBus.on('performance:bottleneck', async (data: { component: string; severity: string }) => {
        logger.warn('Performance bottleneck detected', {
            component: data.component,
            severity: data.severity
        });
        metricsCollector.incrementCounter('performance.bottlenecks', 1);
    });
}

/**
 * Start monitoring the extraction process
 */
function startExtractionMonitoring(
    extractorService: IExtractor,
    logger: ILogger,
    performanceMonitor: PerformanceMonitor
): void {
    // Monitor WhatsApp modal for changes
    const observer = new MutationObserver(async (mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                // Check for modal appearance
                const modalElems = document.querySelectorAll('[data-animate-modal-body="true"]');
                if (modalElems.length > 0) {
                    logger.info('WhatsApp modal detected, starting extraction');
                    
                    // Measure extraction performance
                    const result = await performanceMonitor.measurePerformanceAsync(
                        'modal-extraction',
                        async () => {
                            await extractorService.startExtraction({
                                modal: modalElems[0] as HTMLElement
                            });
                        }
                    );

                    logger.info('Extraction completed', {
                        duration: result.endTime - result.startTime,
                        success: result.success
                    });
                }
            }
        }
    });

    // Start observing the app container
    const app = document.getElementById('app');
    if (app) {
        observer.observe(app, {
            attributes: true,
            childList: true,
            subtree: true
        });
        logger.info('Started monitoring WhatsApp app for modals');
    } else {
        logger.error('WhatsApp app container not found');
    }
}

/**
 * Error boundary for the application
 */
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    // Try to log to our logger if available
    const container = (window as any).__appContainer as DIContainer;
    if (container) {
        try {
            const logger = container.resolve<ILogger>(TOKENS.Logger);
            logger.error('Unhandled window error', event.error, {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        } catch (e) {
            // Logger not available, already logged to console
        }
    }
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Try to log to our logger if available
    const container = (window as any).__appContainer as DIContainer;
    if (container) {
        try {
            const logger = container.resolve<ILogger>(TOKENS.Logger);
            logger.error('Unhandled promise rejection', new Error(String(event.reason)), {
                reason: event.reason
            });
        } catch (e) {
            // Logger not available, already logged to console
        }
    }
});

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    // DOM already loaded
    startApplication();
}