import { EventBus, SystemEvents } from './EventBus';
import { AppConfig, ConfigValidationResult, ConfigError, ConfigWarning } from '../types/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration Service
 * Manages application configuration with validation, hot-reloading, and environment support
 */
export class ConfigService {
  private config: AppConfig;
  private configPath: string;
  private envOverrides: Partial<AppConfig> = {};
  private eventBus: EventBus;
  private watcherEnabled = false;
  private watcher?: fs.FSWatcher;
  private validators: Array<(config: AppConfig) => ConfigValidationResult> = [];

  constructor(configPath?: string, eventBus?: EventBus) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.eventBus = eventBus || new EventBus();
    this.config = this.getDefaultConfig();
    
    // Load configuration on initialization
    this.loadConfig();
  }

  /**
   * Get a configuration value
   */
  get<T = any>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue as T;
      }
    }

    return value as T;
  }

  /**
   * Set a configuration value
   */
  set(path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let target: any = this.config;

    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    const oldValue = target[lastKey];
    target[lastKey] = value;

    // Emit change event
    this.eventBus.emit(SystemEvents.CONFIG_CHANGED, {
      path,
      oldValue,
      newValue: value,
    });
  }

  /**
   * Get the entire configuration
   */
  getAll(): AppConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Load configuration from file
   */
  loadConfig(): void {
    try {
      // Load from file if exists
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        this.config = this.mergeConfigs(this.getDefaultConfig(), fileConfig);
      }

      // Apply environment overrides
      this.applyEnvironmentOverrides();

      // Validate configuration
      const validation = this.validate();
      if (!validation.valid) {
        throw new Error(
          `Configuration validation failed:\n${validation.errors
            .map(e => `- ${e.path}: ${e.message}`)
            .join('\n')}`
        );
      }

      // Log warnings
      if (validation.warnings.length > 0) {
        console.warn(
          'Configuration warnings:\n' +
            validation.warnings.map(w => `- ${w.path}: ${w.message}`).join('\n')
        );
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Reload configuration
   */
  reload(): void {
    this.loadConfig();
    this.eventBus.emit(SystemEvents.CONFIG_CHANGED, { reloaded: true });
  }

  /**
   * Enable configuration file watching
   */
  enableWatcher(): void {
    if (this.watcherEnabled) return;

    try {
      this.watcher = fs.watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          console.log('Configuration file changed, reloading...');
          this.reload();
        }
      });
      this.watcherEnabled = true;
    } catch (error) {
      console.error('Failed to enable config watcher:', error);
    }
  }

  /**
   * Disable configuration file watching
   */
  disableWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      this.watcherEnabled = false;
    }
  }

  /**
   * Add a custom validator
   */
  addValidator(validator: (config: AppConfig) => ConfigValidationResult): void {
    this.validators.push(validator);
  }

  /**
   * Validate configuration
   */
  validate(): ConfigValidationResult {
    const errors: ConfigError[] = [];
    const warnings: ConfigWarning[] = [];

    // Built-in validations
    this.validateRequired(errors);
    this.validateTypes(errors);
    this.validateRanges(errors, warnings);
    this.validateDependencies(errors, warnings);

    // Custom validators
    for (const validator of this.validators) {
      const result = validator(this.config);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Private helper methods
   */
  private getDefaultConfigPath(): string {
    const configDir = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
    const env = process.env.NODE_ENV || 'development';
    return path.join(configDir, `config.${env}.json`);
  }

  private getDefaultConfig(): AppConfig {
    return {
      app: {
        name: 'WhatsApp Group Scraper',
        version: '1.0.0',
        environment: (process.env.NODE_ENV as any) || 'development',
        debug: process.env.NODE_ENV !== 'production',
        locale: 'en-US',
        timezone: 'UTC',
      },
      whatsapp: {
        sessionPath: './sessions',
        qrCodeRetries: 3,
        connectionTimeout: 60000,
        reconnectInterval: 5000,
        maxReconnectAttempts: 5,
        headless: true,
        puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
        rateLimiting: {
          enabled: true,
          maxRequests: 100,
          windowMs: 60000,
        },
      },
      storage: {
        type: 'file',
        path: './data',
        cache: {
          enabled: true,
          ttl: 3600000,
          maxSize: 100,
          strategy: 'lru',
          checkPeriod: 600000,
        },
      },
      export: {
        outputPath: './exports',
        defaultFormat: 'json',
        maxExportSize: 10485760, // 10MB
        compressionEnabled: true,
        includeMetadata: true,
      },
      security: {
        encryptionEnabled: false,
        rateLimiting: {
          enabled: true,
          maxRequests: 1000,
          windowMs: 60000,
        },
        sessionTimeout: 3600000,
        maxLoginAttempts: 3,
        sanitizeOutput: true,
      },
      logging: {
        level: 'info',
        outputPath: './logs',
        maxFileSize: 10485760,
        maxFiles: 5,
        enableConsole: true,
        enableFile: true,
        enableRemote: false,
        format: 'json',
      },
      ui: {
        theme: 'auto',
        language: 'en',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h',
        animations: true,
        compactMode: false,
        defaultView: 'grid',
      },
      features: {
        enableAnalytics: true,
        enableExperimentalFeatures: false,
        enableAutoUpdate: true,
        enableCrashReporting: true,
        enableTelemetry: false,
        enableOfflineMode: true,
        enableMultiAccount: false,
        enableCloudSync: false,
      },
    };
  }

  private mergeConfigs(base: any, override: any): any {
    const result = { ...base };

    for (const key in override) {
      if (override.hasOwnProperty(key)) {
        if (
          typeof override[key] === 'object' &&
          override[key] !== null &&
          !Array.isArray(override[key])
        ) {
          result[key] = this.mergeConfigs(base[key] || {}, override[key]);
        } else {
          result[key] = override[key];
        }
      }
    }

    return result;
  }

  private applyEnvironmentOverrides(): void {
    // Map environment variables to config paths
    const envMappings: Record<string, string> = {
      APP_NAME: 'app.name',
      APP_ENV: 'app.environment',
      APP_DEBUG: 'app.debug',
      WHATSAPP_SESSION_PATH: 'whatsapp.sessionPath',
      WHATSAPP_HEADLESS: 'whatsapp.headless',
      STORAGE_TYPE: 'storage.type',
      STORAGE_PATH: 'storage.path',
      LOG_LEVEL: 'logging.level',
      ENABLE_ANALYTICS: 'features.enableAnalytics',
      ENABLE_TELEMETRY: 'features.enableTelemetry',
    };

    for (const [envKey, configPath] of Object.entries(envMappings)) {
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        this.set(configPath, this.parseEnvValue(envValue));
      }
    }
  }

  private parseEnvValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }

  private validateRequired(errors: ConfigError[]): void {
    const requiredPaths = [
      'app.name',
      'app.version',
      'whatsapp.sessionPath',
      'storage.type',
      'export.outputPath',
      'logging.level',
    ];

    for (const path of requiredPaths) {
      const value = this.get(path);
      if (value === undefined || value === null || value === '') {
        errors.push({
          path,
          message: 'Required configuration value is missing',
        });
      }
    }
  }

  private validateTypes(errors: ConfigError[]): void {
    const typeChecks: Array<{ path: string; type: string; validator: (v: any) => boolean }> = [
      { path: 'app.debug', type: 'boolean', validator: v => typeof v === 'boolean' },
      { path: 'whatsapp.qrCodeRetries', type: 'number', validator: v => typeof v === 'number' },
      { path: 'whatsapp.headless', type: 'boolean', validator: v => typeof v === 'boolean' },
      { path: 'storage.cache.enabled', type: 'boolean', validator: v => typeof v === 'boolean' },
      { path: 'logging.maxFiles', type: 'number', validator: v => typeof v === 'number' },
    ];

    for (const check of typeChecks) {
      const value = this.get(check.path);
      if (value !== undefined && !check.validator(value)) {
        errors.push({
          path: check.path,
          message: `Expected ${check.type}, got ${typeof value}`,
          value,
        });
      }
    }
  }

  private validateRanges(errors: ConfigError[], warnings: ConfigWarning[]): void {
    // Validate numeric ranges
    const rangeChecks = [
      { path: 'whatsapp.qrCodeRetries', min: 1, max: 10 },
      { path: 'whatsapp.maxReconnectAttempts', min: 0, max: 100 },
      { path: 'logging.maxFiles', min: 1, max: 100 },
      { path: 'security.maxLoginAttempts', min: 1, max: 10 },
    ];

    for (const check of rangeChecks) {
      const value = this.get(check.path);
      if (typeof value === 'number') {
        if (value < check.min || value > check.max) {
          errors.push({
            path: check.path,
            message: `Value must be between ${check.min} and ${check.max}`,
            value,
          });
        }
      }
    }

    // Validate storage type
    const storageType = this.get('storage.type');
    if (!['memory', 'file', 'database'].includes(storageType)) {
      errors.push({
        path: 'storage.type',
        message: 'Invalid storage type',
        value: storageType,
      });
    }
  }

  private validateDependencies(errors: ConfigError[], warnings: ConfigWarning[]): void {
    // Check dependent configurations
    if (this.get('storage.type') === 'database' && !this.get('storage.connectionString')) {
      errors.push({
        path: 'storage.connectionString',
        message: 'Connection string required for database storage',
      });
    }

    if (this.get('security.encryptionEnabled') && !this.get('security.encryptionKey')) {
      warnings.push({
        path: 'security.encryptionKey',
        message: 'Encryption enabled but no key provided',
        suggestion: 'Set security.encryptionKey or disable encryption',
      });
    }

    if (this.get('logging.enableRemote') && !this.get('logging.remoteEndpoint')) {
      errors.push({
        path: 'logging.remoteEndpoint',
        message: 'Remote endpoint required when remote logging is enabled',
      });
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disableWatcher();
  }
}