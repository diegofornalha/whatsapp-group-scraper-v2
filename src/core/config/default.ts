/**
 * Default configuration for the WhatsApp Group Scraper
 */

import { AppConfig } from '../../types/config';
import { LogLevel } from '../../types/ILogger';

export const defaultConfig: AppConfig = {
    app: {
        name: 'whatsapp-users-scraper',
        version: '2.0.0',
        environment: 'browser'
    },
    logging: {
        level: LogLevel.INFO,
        format: 'json',
        enableConsole: true,
        enableFile: false,
        maxFileSize: 10485760, // 10MB
        maxFiles: 5
    },
    security: {
        enableRateLimiting: true,
        enableAnomalyDetection: true,
        enableAuditLogging: true,
        rateLimits: {
            extraction: {
                windowMs: 60000, // 1 minute
                maxRequests: 100
            },
            export: {
                windowMs: 300000, // 5 minutes
                maxRequests: 10
            }
        }
    },
    storage: {
        maxMembers: 10000,
        enableCompression: true,
        enableEncryption: false
    },
    extraction: {
        scrollDelay: 500,
        batchSize: 50,
        enableDuplicateDetection: true,
        enablePhoneValidation: true
    },
    ui: {
        theme: 'light',
        position: 'bottom-right',
        enableDragging: true,
        enableMinimize: true,
        showMetrics: true
    },
    performance: {
        enableBottleneckDetection: true,
        bottleneckThreshold: 1000, // ms
        metricsInterval: 5000, // 5 seconds
        maxLogEntries: 1000
    }
};