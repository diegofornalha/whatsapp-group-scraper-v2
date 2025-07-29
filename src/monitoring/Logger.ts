import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const appendFile = promisify(fs.appendFile);
const mkdir = promisify(fs.mkdir);

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  levelName: string;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: Error;
  correlationId?: string;
  source?: string;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDirectory: string;
  maxFileSize: number;
  maxFiles: number;
  format: 'json' | 'text';
  contextFilter?: string[];
}

export class Logger extends EventEmitter {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushInterval?: NodeJS.Timeout;
  private currentLogFile?: string;
  private logStream?: fs.WriteStream;
  private static instance?: Logger;

  constructor(config: Partial<LoggerConfig> = {}) {
    super();
    this.config = {
      minLevel: LogLevel.INFO,
      enableConsole: true,
      enableFile: true,
      logDirectory: './logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: 'json',
      ...config
    };
  }

  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  async initialize(): Promise<void> {
    if (this.config.enableFile) {
      await this.ensureLogDirectory();
      await this.rotateLogFiles();
      this.startFlushInterval();
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, 1000); // Flush every second
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    if (this.config.enableFile) {
      await this.writeToFile(entries);
    }
  }

  private async writeToFile(entries: LogEntry[]): Promise<void> {
    const logFile = await this.getCurrentLogFile();
    const content = entries
      .map(entry => this.formatLogEntry(entry))
      .join('\n') + '\n';

    try {
      await appendFile(logFile, content);
      await this.checkRotation();
    } catch (error) {
      console.error('Failed to write logs:', error);
    }
  }

  private async getCurrentLogFile(): Promise<string> {
    if (!this.currentLogFile) {
      const timestamp = new Date().toISOString().split('T')[0];
      this.currentLogFile = path.join(
        this.config.logDirectory,
        `app-${timestamp}.log`
      );
    }
    return this.currentLogFile;
  }

  private async checkRotation(): Promise<void> {
    const logFile = await this.getCurrentLogFile();
    try {
      const stats = await promisify(fs.stat)(logFile);
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLogFiles();
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
    }
  }

  private async rotateLogFiles(): Promise<void> {
    this.currentLogFile = undefined;
    
    // Clean up old log files
    try {
      const files = await promisify(fs.readdir)(this.config.logDirectory);
      const logFiles = files
        .filter(f => f.startsWith('app-') && f.endsWith('.log'))
        .sort()
        .reverse();

      if (logFiles.length > this.config.maxFiles) {
        for (const file of logFiles.slice(this.config.maxFiles)) {
          await promisify(fs.unlink)(
            path.join(this.config.logDirectory, file)
          );
        }
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.levelName,
        message: entry.message,
        context: entry.context,
        metadata: entry.metadata,
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack,
          name: entry.error.name
        } : undefined,
        correlationId: entry.correlationId,
        source: entry.source
      });
    } else {
      const parts = [
        entry.timestamp.toISOString(),
        `[${entry.levelName}]`,
        entry.context ? `[${entry.context}]` : '',
        entry.message
      ].filter(Boolean);

      if (entry.metadata) {
        parts.push(JSON.stringify(entry.metadata));
      }

      if (entry.error) {
        parts.push(`\nError: ${entry.error.message}\n${entry.error.stack}`);
      }

      return parts.join(' ');
    }
  }

  private shouldLog(level: LogLevel, context?: string): boolean {
    if (level < this.config.minLevel) return false;
    
    if (context && this.config.contextFilter?.length) {
      return this.config.contextFilter.some(filter => 
        context.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return true;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    error?: Error
  ): void {
    if (!this.shouldLog(level, context)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      levelName: LogLevel[level],
      message,
      context,
      metadata,
      error,
      source: this.getCallerInfo()
    };

    this.buffer.push(entry);
    this.emit('log', entry);

    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }
  }

  private getCallerInfo(): string {
    const stack = new Error().stack?.split('\n');
    if (stack && stack.length > 4) {
      const callerLine = stack[4];
      const match = callerLine.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
      if (match) {
        return `${match[1]} (${path.basename(match[2])}:${match[3]})`;
      }
    }
    return 'unknown';
  }

  private logToConsole(entry: LogEntry): void {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[37m',    // White
      [LogLevel.INFO]: '\x1b[36m',     // Cyan
      [LogLevel.WARN]: '\x1b[33m',     // Yellow
      [LogLevel.ERROR]: '\x1b[31m',    // Red
      [LogLevel.CRITICAL]: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level] || reset;

    let message = `${color}[${entry.levelName}]${reset}`;
    if (entry.context) {
      message += ` [${entry.context}]`;
    }
    message += ` ${entry.message}`;

    if (entry.metadata) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }

    switch (entry.level) {
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message);
        if (entry.error) {
          console.error(entry.error);
        }
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  }

  // Public logging methods
  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }

  info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  error(
    message: string,
    error?: Error,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    this.log(LogLevel.ERROR, message, context, metadata, error);
  }

  critical(
    message: string,
    error?: Error,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    this.log(LogLevel.CRITICAL, message, context, metadata, error);
  }

  // Utility methods
  createContext(context: string): ContextualLogger {
    return new ContextualLogger(this, context);
  }

  async getRecentLogs(
    count: number = 100,
    filter?: Partial<LogEntry>
  ): Promise<LogEntry[]> {
    await this.flush();
    
    // In a real implementation, this would read from files
    // For now, return from buffer
    return this.buffer.slice(-count);
  }

  setLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  async dispose(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
    if (this.logStream) {
      this.logStream.close();
    }
  }
}

export class ContextualLogger {
  constructor(
    private logger: Logger,
    private context: string
  ) {}

  debug(message: string, metadata?: Record<string, any>): void {
    this.logger.debug(message, this.context, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.logger.info(message, this.context, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.logger.warn(message, this.context, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.logger.error(message, error, this.context, metadata);
  }

  critical(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.logger.critical(message, error, this.context, metadata);
  }
}