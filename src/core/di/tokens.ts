/**
 * Dependency injection tokens for type-safe service resolution
 */

export const TOKENS = {
    // Core services
    EventBus: Symbol('EventBus'),
    ConfigService: Symbol('ConfigService'),
    ServiceRegistry: Symbol('ServiceRegistry'),

    // Logging and monitoring
    Logger: Symbol('Logger'),
    MetricsCollector: Symbol('MetricsCollector'),
    PerformanceMonitor: Symbol('PerformanceMonitor'),

    // Security services
    SecurityManager: Symbol('SecurityManager'),
    AuditLogger: Symbol('AuditLogger'),
    InputValidator: Symbol('InputValidator'),
    AnomalyDetector: Symbol('AnomalyDetector'),
    SecureDataHandler: Symbol('SecureDataHandler'),

    // Business services
    Storage: Symbol('Storage'),
    Extractor: Symbol('Extractor'),
    UIService: Symbol('UIService')
};