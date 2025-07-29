import { LogLevel } from './ILogger';

/**
 * Application configuration types
 */
export interface AppConfig {
  app: ApplicationSettings;
  whatsapp: WhatsAppSettings;
  storage: StorageSettings;
  export: ExportSettings;
  security: SecuritySettings;
  logging: LoggingSettings;
  ui: UISettings;
  api?: APISettings;
  features: FeatureFlags;
}

export interface ApplicationSettings {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  locale: string;
  timezone: string;
  instanceId?: string;
}

export interface WhatsAppSettings {
  sessionPath: string;
  qrCodeRetries: number;
  connectionTimeout: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  headless: boolean;
  userAgent?: string;
  puppeteerArgs?: string[];
  rateLimiting: RateLimitConfig;
}

export interface StorageSettings {
  type: 'memory' | 'file' | 'database';
  path?: string;
  connectionString?: string;
  options?: Record<string, any>;
  cache?: CacheConfig;
  backup?: BackupConfig;
}

export interface ExportSettings {
  outputPath: string;
  defaultFormat: 'json' | 'csv' | 'xlsx' | 'pdf' | 'html';
  templatePath?: string;
  maxExportSize: number;
  compressionEnabled: boolean;
  includeMetadata: boolean;
  customFields?: string[];
}

export interface SecuritySettings {
  encryptionEnabled: boolean;
  encryptionKey?: string;
  rateLimiting: RateLimitConfig;
  allowedOrigins?: string[];
  trustedProxies?: string[];
  sessionTimeout: number;
  maxLoginAttempts: number;
  sanitizeOutput: boolean;
}

export interface LoggingSettings {
  level: LogLevel;
  outputPath: string;
  maxFileSize: number;
  maxFiles: number;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  format: 'json' | 'text' | 'pretty';
}

export interface UISettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  animations: boolean;
  compactMode: boolean;
  defaultView: 'grid' | 'list' | 'table';
}

export interface APISettings {
  enabled: boolean;
  port: number;
  host: string;
  basePath: string;
  apiKey?: string;
  cors: CORSConfig;
  rateLimit: RateLimitConfig;
  documentation: boolean;
}

export interface FeatureFlags {
  enableAnalytics: boolean;
  enableExperimentalFeatures: boolean;
  enableAutoUpdate: boolean;
  enableCrashReporting: boolean;
  enableTelemetry: boolean;
  enableOfflineMode: boolean;
  enableMultiAccount: boolean;
  enableCloudSync: boolean;
}

export interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
  delayAfter?: number;
  delayMs?: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: string;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'lfu' | 'fifo';
  checkPeriod: number;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retention: number; // days
  compress: boolean;
  encrypt: boolean;
  destinations: BackupDestination[];
}

export interface BackupDestination {
  type: 'local' | 's3' | 'gdrive' | 'dropbox';
  path: string;
  credentials?: Record<string, any>;
}

export interface CORSConfig {
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
}

export interface ConfigError {
  path: string;
  message: string;
  value?: any;
}

export interface ConfigWarning {
  path: string;
  message: string;
  suggestion?: string;
}