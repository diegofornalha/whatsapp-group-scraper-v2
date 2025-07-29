/**
 * Core configuration interfaces
 */

/**
 * Base configuration interface
 */
export interface IConfig {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
  delete(key: string): void;
  getAll(): Record<string, any>;
  validate(): ValidationResult<IConfig>;
}

/**
 * Application configuration
 */
export interface IAppConfig extends IConfig {
  app: AppSettings;
  database: DatabaseConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  storage: StorageSettings;
  extraction: ExtractionConfig;
  ui: UIConfig;
  api: APIConfig;
}

/**
 * App settings
 */
export interface AppSettings {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  timezone: string;
  locale: string;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql' | 'mongodb';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  connectionPool?: {
    min: number;
    max: number;
    idle: number;
  };
  ssl?: boolean;
  options?: Record<string, any>;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  authentication: {
    enabled: boolean;
    strategy: 'jwt' | 'session' | 'apikey';
    secretKey: string;
    tokenExpiry: number;
    refreshTokenExpiry: number;
  };
  authorization: {
    enabled: boolean;
    defaultRole: string;
    rbac: boolean;
  };
  encryption: {
    algorithm: string;
    keyRotation: boolean;
    keyRotationInterval: number;
  };
  rateLimiting: {
    enabled: boolean;
    defaultLimit: number;
    windowMs: number;
    skipSuccessfulRequests: boolean;
  };
  cors: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
  };
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  performance: {
    enabled: boolean;
    sampleRate: number;
    slowThreshold: number;
  };
  errors: {
    enabled: boolean;
    captureUnhandled: boolean;
    ignoredErrors: string[];
  };
  metrics: {
    enabled: boolean;
    exportInterval: number;
    exporters: MetricExporter[];
  };
  health: {
    enabled: boolean;
    checkInterval: number;
    endpoints: string[];
  };
}

/**
 * Storage settings
 */
export interface StorageSettings {
  dataPath: string;
  mediaPath: string;
  tempPath: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  compression: {
    enabled: boolean;
    level: number;
  };
  cleanup: {
    enabled: boolean;
    interval: number;
    maxAge: number;
  };
}

/**
 * Extraction configuration
 */
export interface ExtractionConfig {
  browser: {
    type: 'chromium' | 'firefox' | 'webkit';
    headless: boolean;
    timeout: number;
    userDataDir?: string;
    args?: string[];
  };
  whatsapp: {
    webUrl: string;
    loginTimeout: number;
    messageLoadDelay: number;
    scrollDelay: number;
    maxScrollAttempts: number;
  };
  extraction: {
    batchSize: number;
    retryAttempts: number;
    retryDelay: number;
    concurrent: boolean;
    maxConcurrency: number;
  };
  filters: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    groups?: string[];
    users?: string[];
    messageTypes?: string[];
  };
}

/**
 * UI configuration
 */
export interface UIConfig {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  pageSize: number;
  features: {
    analytics: boolean;
    export: boolean;
    search: boolean;
    filters: boolean;
    realtime: boolean;
  };
}

/**
 * API configuration
 */
export interface APIConfig {
  enabled: boolean;
  host: string;
  port: number;
  basePath: string;
  version: string;
  documentation: {
    enabled: boolean;
    path: string;
  };
  pagination: {
    defaultLimit: number;
    maxLimit: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    invalidateOnUpdate: boolean;
  };
}

/**
 * Metric exporter configuration
 */
export interface MetricExporter {
  type: 'console' | 'file' | 'prometheus' | 'cloudwatch' | 'datadog';
  endpoint?: string;
  apiKey?: string;
  interval?: number;
  options?: Record<string, any>;
}

/**
 * Configuration loader interface
 */
export interface IConfigLoader {
  load(source: ConfigSource): Promise<Record<string, any>>;
  save(config: Record<string, any>, destination: ConfigSource): Promise<void>;
  merge(...configs: Record<string, any>[]): Record<string, any>;
  validate(config: Record<string, any>, schema: ConfigSchema): ValidationResult<Record<string, any>>;
}

/**
 * Configuration source
 */
export interface ConfigSource {
  type: 'file' | 'env' | 'remote' | 'database';
  path?: string;
  url?: string;
  format?: 'json' | 'yaml' | 'toml' | 'env';
  options?: Record<string, any>;
}

/**
 * Configuration schema for validation
 */
export interface ConfigSchema {
  properties: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Schema property definition
 */
export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  required?: boolean;
}

/**
 * Configuration watcher interface
 */
export interface IConfigWatcher {
  watch(source: ConfigSource, callback: ConfigChangeCallback): void;
  unwatch(source: ConfigSource): void;
  unwatchAll(): void;
}

/**
 * Configuration change callback
 */
export type ConfigChangeCallback = (changes: ConfigChange[]) => void;

/**
 * Configuration change
 */
export interface ConfigChange {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

/**
 * Environment-specific configuration
 */
export interface IEnvironmentConfig extends IConfig {
  isDevelopment(): boolean;
  isStaging(): boolean;
  isProduction(): boolean;
  getEnvironment(): string;
  getFeatureFlags(): Record<string, boolean>;
}

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  errors?: ConfigValidationError[];
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  path: string;
  message: string;
  expected?: any;
  actual?: any;
}

/**
 * Configuration manager interface
 */
export interface IConfigManager {
  load(sources: ConfigSource[]): Promise<void>;
  reload(): Promise<void>;
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  watch(callback: ConfigChangeCallback): void;
  validate(): ValidationResult<IAppConfig>;
  export(format: 'json' | 'yaml' | 'env'): string;
}