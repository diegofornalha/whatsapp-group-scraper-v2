/**
 * Application bootstrapper - Configures dependency injection and initializes all services
 */

import { DIContainer, createDIContainer } from './Container';
import { TOKENS } from './tokens';
import { EventBus } from '../EventBus';
import { ConfigService } from '../ConfigService';
import { ServiceRegistry } from '../ServiceRegistry';
import { Logger } from '../../monitoring/Logger';
import { MetricsCollector } from '../../monitoring/MetricsCollector';
import { PerformanceMonitor } from '../../monitoring/PerformanceMonitor';
import { SecurityManager } from '../security/SecurityManager';
import { AuditLogger } from '../security/AuditLogger';
import { InputValidator } from '../security/InputValidator';
import { AnomalyDetector } from '../security/AnomalyDetector';
import { SecureDataHandler } from '../security/SecureDataHandler';
import { WhatsAppExtractorService } from '../../extractors/WhatsAppExtractorService';
import { WhatsAppStorageService } from '../../storage/WhatsAppStorageService';
import { UIService } from '../../ui/UIService';
import { LogLevel } from '../../types/ILogger';
import { defaultConfig } from '../config/default';

/**
 * Bootstrap the application with all dependencies configured
 */
export async function bootstrapApplication(): Promise<{
    container: DIContainer;
    serviceRegistry: ServiceRegistry;
}> {
    // Create DI container
    const container = createDIContainer();

    // Register configuration first
    const config = new ConfigService(defaultConfig);
    container.singleton(TOKENS.ConfigService, () => config);

    // Register core services
    container.singleton(TOKENS.EventBus, () => new EventBus());
    
    // Register logging services
    container.singleton(TOKENS.Logger, () => new Logger({
        minLevel: LogLevel.INFO,
        format: 'json',
        enableConsole: true,
        enableFile: false // No file system in browser
    }));

    // Register monitoring services
    container.singleton(TOKENS.MetricsCollector, (c) => new MetricsCollector(
        c.resolve(TOKENS.EventBus)
    ));

    container.singleton(TOKENS.PerformanceMonitor, (c) => new PerformanceMonitor(
        c.resolve(TOKENS.EventBus),
        c.resolve(TOKENS.MetricsCollector)
    ));

    // Register security services
    container.singleton(TOKENS.AuditLogger, () => new AuditLogger());
    container.singleton(TOKENS.InputValidator, () => new InputValidator());
    container.singleton(TOKENS.AnomalyDetector, () => new AnomalyDetector());
    container.singleton(TOKENS.SecureDataHandler, () => new SecureDataHandler());

    container.singleton(TOKENS.SecurityManager, (c) => new SecurityManager(
        c.resolve(TOKENS.AnomalyDetector),
        c.resolve(TOKENS.InputValidator),
        c.resolve(TOKENS.AuditLogger),
        c.resolve(TOKENS.SecureDataHandler)
    ));

    // Register business services
    container.singleton(TOKENS.Storage, (c) => new WhatsAppStorageService(
        c.resolve(TOKENS.EventBus),
        c.resolve(TOKENS.Logger),
        c.resolve(TOKENS.SecurityManager)
    ));

    container.singleton(TOKENS.Extractor, (c) => new WhatsAppExtractorService(
        c.resolve(TOKENS.EventBus),
        c.resolve(TOKENS.Logger),
        c.resolve(TOKENS.SecurityManager),
        c.resolve(TOKENS.Storage),
        c.resolve(TOKENS.MetricsCollector)
    ));

    container.singleton(TOKENS.UIService, (c) => new UIService(
        c.resolve(TOKENS.EventBus),
        c.resolve(TOKENS.Logger),
        c.resolve(TOKENS.Storage),
        c.resolve(TOKENS.MetricsCollector),
        c.resolve(TOKENS.ConfigService)
    ));

    // Create service registry
    const serviceRegistry = new ServiceRegistry(
        container.resolve(TOKENS.EventBus),
        container.resolve(TOKENS.Logger)
    );

    // Register all services with the registry
    const services = [
        container.resolve(TOKENS.MetricsCollector),
        container.resolve(TOKENS.PerformanceMonitor),
        container.resolve(TOKENS.Storage),
        container.resolve(TOKENS.Extractor),
        container.resolve(TOKENS.UIService)
    ];

    for (const service of services) {
        await serviceRegistry.register(service);
    }

    // Store container globally for error handlers
    (window as any).__appContainer = container;

    return {
        container,
        serviceRegistry
    };
}