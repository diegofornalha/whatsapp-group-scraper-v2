/**
 * Logger interface for application logging
 */
export interface ILogger {
  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void;

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, context?: LogContext): void;

  /**
   * Create child logger with specific context
   */
  createChild(context: LogContext): ILogger;

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void;

  /**
   * Get current log level
   */
  getLevel(): LogLevel;

  /**
   * Add log transport
   */
  addTransport(transport: ILogTransport): void;

  /**
   * Remove log transport
   */
  removeTransport(transportId: string): void;

  /**
   * Flush all pending logs
   */
  flush(): Promise<void>;

  /**
   * Query logs
   */
  query(options: LogQueryOptions): Promise<LogEntry[]>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

export interface LogContext {
  module?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  groupId?: string;
  operationId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  error?: ErrorInfo;
  context?: LogContext;
  hostname?: string;
  pid?: number;
}

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  details?: Record<string, any>;
}

export interface ILogTransport {
  id: string;
  name: string;
  level?: LogLevel;
  format?: LogFormat;
  write(entry: LogEntry): Promise<void>;
  query?(options: LogQueryOptions): Promise<LogEntry[]>;
  close?(): Promise<void>;
}

export type LogFormat = 'json' | 'text' | 'pretty' | 'custom';

export interface LogQueryOptions {
  from?: Date;
  to?: Date;
  levels?: LogLevel[];
  modules?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface LoggerConfig {
  level: LogLevel;
  transports: TransportConfig[];
  contextDefaults?: LogContext;
  errorStackTraceLimit?: number;
  bufferSize?: number;
  flushInterval?: number;
}

export interface TransportConfig {
  type: 'console' | 'file' | 'database' | 'remote' | 'custom';
  level?: LogLevel;
  format?: LogFormat;
  options?: Record<string, any>;
}

export interface FileTransportOptions {
  filename: string;
  maxSize?: number;
  maxFiles?: number;
  compress?: boolean;
  datePattern?: string;
}

export interface RemoteTransportOptions {
  url: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
  retryOnError?: boolean;
}