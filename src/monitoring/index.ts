/**
 * Monitoring Module
 * 
 * Provides comprehensive logging, metrics collection, and performance monitoring
 * for the WhatsApp Group Scraper application.
 */

// Core monitoring components
export { Logger, LogLevel, LogEntry, ContextualLogger } from './Logger';
export type { LoggerConfig } from './Logger';

export { MetricsCollector, MetricType, Metric } from './MetricsCollector';
export type { 
  MetricDefinition, 
  MetricsSnapshot, 
  SystemMetrics,
  MetricsCollectorConfig 
} from './MetricsCollector';

export { PerformanceMonitor } from './PerformanceMonitor';
export type { 
  PerformanceMetric,
  PerformanceBottleneck,
  PerformanceThreshold,
  PerformanceProfile,
  PerformanceMonitorConfig 
} from './PerformanceMonitor';

// UI components
export { MetricsDashboard } from './MetricsDashboard';
export { LogViewer } from './LogViewer';

// Factory function to create a fully configured monitoring system
export function createMonitoringSystem(config?: {
  logger?: Partial<import('./Logger').LoggerConfig>;
  metrics?: Partial<import('./MetricsCollector').MetricsCollectorConfig>;
  performance?: Partial<import('./PerformanceMonitor').PerformanceMonitorConfig>;
}) {
  const logger = Logger.getInstance(config?.logger);
  const metricsCollector = new MetricsCollector(config?.metrics);
  const performanceMonitor = new PerformanceMonitor(
    metricsCollector,
    logger,
    config?.performance
  );

  return {
    logger,
    metricsCollector,
    performanceMonitor,
    
    // Helper methods
    async initialize() {
      await logger.initialize();
      await metricsCollector.initialize();
      await metricsCollector.start();
    },

    async shutdown() {
      await metricsCollector.stop();
      await metricsCollector.dispose();
      performanceMonitor.dispose();
      await logger.dispose();
    },

    // Convenience methods
    createContextLogger(context: string) {
      return logger.createContext(context);
    },

    startPerformanceProfile(name: string) {
      performanceMonitor.startProfile(name);
    },

    measurePerformance<T>(name: string, fn: () => T): T {
      return performanceMonitor.measure(name, fn);
    },

    async measurePerformanceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
      return performanceMonitor.measureAsync(name, fn);
    }
  };
}

// Type for the monitoring system
export type MonitoringSystem = ReturnType<typeof createMonitoringSystem>;