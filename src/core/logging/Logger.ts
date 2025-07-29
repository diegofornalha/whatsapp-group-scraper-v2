import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// Níveis de log
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

// Interface para contexto de log
export interface LogContext {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  category?: string;
  traceId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

// Interface para transportadores de log
export interface LogTransport {
  name: string;
  log(context: LogContext): void;
}

// Formatador de logs
export class LogFormatter {
  static formatConsole(context: LogContext): string {
    const levelColors = {
      [LogLevel.TRACE]: '\x1b[37m',  // Branco
      [LogLevel.DEBUG]: '\x1b[36m',  // Ciano
      [LogLevel.INFO]: '\x1b[32m',   // Verde
      [LogLevel.WARN]: '\x1b[33m',   // Amarelo
      [LogLevel.ERROR]: '\x1b[31m',  // Vermelho
      [LogLevel.FATAL]: '\x1b[35m'   // Magenta
    };

    const reset = '\x1b[0m';
    const color = levelColors[context.level];
    const levelName = LogLevel[context.level];
    
    const timestamp = context.timestamp.toISOString();
    const category = context.category ? `[${context.category}]` : '';
    
    let message = `${color}[${timestamp}] ${levelName}${reset} ${category} ${context.message}`;
    
    if (context.data) {
      message += '\n' + JSON.stringify(context.data, null, 2);
    }
    
    return message;
  }

  static formatJSON(context: LogContext): string {
    return JSON.stringify({
      timestamp: context.timestamp.toISOString(),
      level: LogLevel[context.level],
      message: context.message,
      category: context.category,
      traceId: context.traceId,
      correlationId: context.correlationId,
      data: context.data,
      metadata: context.metadata
    });
  }
}

// Transportador Console
export class ConsoleTransport implements LogTransport {
  name = 'console';
  
  constructor(private minLevel: LogLevel = LogLevel.DEBUG) {}
  
  log(context: LogContext): void {
    if (context.level >= this.minLevel) {
      console.log(LogFormatter.formatConsole(context));
    }
  }
}

// Transportador para arquivo
export class FileTransport implements LogTransport {
  name = 'file';
  private stream: fs.WriteStream;
  
  constructor(
    private filepath: string,
    private minLevel: LogLevel = LogLevel.INFO,
    private maxSize: number = 10 * 1024 * 1024 // 10MB
  ) {
    this.ensureDirectory();
    this.stream = fs.createWriteStream(filepath, { flags: 'a' });
  }
  
  private ensureDirectory(): void {
    const dir = path.dirname(this.filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  log(context: LogContext): void {
    if (context.level >= this.minLevel) {
      this.stream.write(LogFormatter.formatJSON(context) + '\n');
      
      // Verificar tamanho do arquivo
      const stats = fs.statSync(this.filepath);
      if (stats.size > this.maxSize) {
        this.rotate();
      }
    }
  }
  
  private rotate(): void {
    this.stream.end();
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const rotatedPath = `${this.filepath}.${timestamp}`;
    fs.renameSync(this.filepath, rotatedPath);
    this.stream = fs.createWriteStream(this.filepath, { flags: 'a' });
  }
  
  close(): void {
    this.stream.end();
  }
}

// Logger principal
export class Logger extends EventEmitter {
  private static instance: Logger;
  private transports: LogTransport[] = [];
  private globalContext: Record<string, any> = {};
  private currentLevel: LogLevel = LogLevel.DEBUG;
  
  private constructor() {
    super();
  }
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  // Configurar nível global
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }
  
  // Adicionar transportador
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }
  
  // Remover transportador
  removeTransport(name: string): void {
    this.transports = this.transports.filter(t => t.name !== name);
  }
  
  // Definir contexto global
  setGlobalContext(context: Record<string, any>): void {
    this.globalContext = { ...this.globalContext, ...context };
  }
  
  // Criar child logger com contexto específico
  child(context: Record<string, any>): ChildLogger {
    return new ChildLogger(this, context);
  }
  
  // Métodos de log
  trace(message: string, data?: any): void {
    this.log(LogLevel.TRACE, message, data);
  }
  
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  error(message: string, error?: Error | any): void {
    const data = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;
    
    this.log(LogLevel.ERROR, message, data);
  }
  
  fatal(message: string, error?: Error | any): void {
    const data = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;
    
    this.log(LogLevel.FATAL, message, data);
  }
  
  // Log com timing
  time(label: string): void {
    this.globalContext[`timer_${label}`] = Date.now();
  }
  
  timeEnd(label: string): void {
    const start = this.globalContext[`timer_${label}`];
    if (start) {
      const duration = Date.now() - start;
      delete this.globalContext[`timer_${label}`];
      this.debug(`${label}: ${duration}ms`);
    }
  }
  
  // Método principal de log
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.currentLevel) return;
    
    const context: LogContext = {
      timestamp: new Date(),
      level,
      message,
      data,
      metadata: this.globalContext
    };
    
    // Emitir evento
    this.emit('log', context);
    
    // Enviar para transportadores
    for (const transport of this.transports) {
      try {
        transport.log(context);
      } catch (error) {
        console.error(`Error in transport ${transport.name}:`, error);
      }
    }
  }
}

// Child Logger com contexto específico
export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, any>
  ) {}
  
  trace(message: string, data?: any): void {
    this.parent.trace(message, { ...this.context, ...data });
  }
  
  debug(message: string, data?: any): void {
    this.parent.debug(message, { ...this.context, ...data });
  }
  
  info(message: string, data?: any): void {
    this.parent.info(message, { ...this.context, ...data });
  }
  
  warn(message: string, data?: any): void {
    this.parent.warn(message, { ...this.context, ...data });
  }
  
  error(message: string, error?: Error | any): void {
    this.parent.error(message, error);
  }
  
  fatal(message: string, error?: Error | any): void {
    this.parent.fatal(message, error);
  }
  
  time(label: string): void {
    this.parent.time(label);
  }
  
  timeEnd(label: string): void {
    this.parent.timeEnd(label);
  }
}

// Exportar instância global
export const logger = Logger.getInstance();

// Configuração padrão
logger.addTransport(new ConsoleTransport(LogLevel.DEBUG));
logger.addTransport(new FileTransport(
  path.join(process.cwd(), 'logs', 'app.log'),
  LogLevel.INFO
));