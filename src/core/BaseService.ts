import { IService, ServiceStatus, HealthCheckResult, ServiceConfig } from '../types/IService';
import { EventBus, SystemEvents } from './EventBus';
import { ILogger } from '../types/ILogger';

/**
 * Base Service Abstract Class
 * Provides common functionality for all services
 */
export abstract class BaseService implements IService {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  protected config: ServiceConfig;
  protected logger?: ILogger;
  protected eventBus?: EventBus;
  protected state: ServiceStatus['state'] = 'stopped';
  protected startTime?: Date;
  protected lastError?: Error;
  protected metadata: Record<string, any> = {};
  protected retryCount = 0;
  protected disposed = false;

  constructor(
    id: string,
    name: string,
    version: string,
    config?: Partial<ServiceConfig>,
    logger?: ILogger,
    eventBus?: EventBus
  ) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.config = this.mergeConfig(config);
    this.logger = logger;
    this.eventBus = eventBus;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.disposed) {
      throw new Error(`Service ${this.name} has been disposed`);
    }

    if (this.state !== 'stopped') {
      throw new Error(`Service ${this.name} is already initialized`);
    }

    this.log('info', `Initializing service ${this.name}...`);

    try {
      await this.onInitialize();
      this.log('info', `Service ${this.name} initialized successfully`);
    } catch (error) {
      this.handleError(error as Error, 'initialization');
      throw error;
    }
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    if (this.disposed) {
      throw new Error(`Service ${this.name} has been disposed`);
    }

    if (this.state === 'running') {
      this.log('warn', `Service ${this.name} is already running`);
      return;
    }

    if (this.state !== 'stopped') {
      throw new Error(`Cannot start service ${this.name} in state: ${this.state}`);
    }

    this.setState('starting');
    this.log('info', `Starting service ${this.name}...`);

    try {
      // Check dependencies
      await this.checkDependencies();

      // Start the service
      await this.onStart();

      this.setState('running');
      this.startTime = new Date();
      this.retryCount = 0;
      this.lastError = undefined;

      this.log('info', `Service ${this.name} started successfully`);
      this.emitEvent(SystemEvents.SERVICE_STARTED, { service: this.name });
    } catch (error) {
      await this.handleStartError(error as Error);
    }
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      this.log('warn', `Service ${this.name} is already stopped`);
      return;
    }

    if (this.state !== 'running') {
      throw new Error(`Cannot stop service ${this.name} in state: ${this.state}`);
    }

    this.setState('stopping');
    this.log('info', `Stopping service ${this.name}...`);

    try {
      await this.onStop();

      this.setState('stopped');
      this.startTime = undefined;

      this.log('info', `Service ${this.name} stopped successfully`);
      this.emitEvent(SystemEvents.SERVICE_STOPPED, { service: this.name });
    } catch (error) {
      this.handleError(error as Error, 'stopping');
      // Force state to stopped even if there was an error
      this.setState('stopped');
      throw error;
    }
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.state === 'running';
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      state: this.state,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : undefined,
      lastError: this.lastError,
      metadata: { ...this.metadata },
    };
  }

  /**
   * Service health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const result = await this.onHealthCheck();
      const duration = Date.now() - startTime;

      return {
        healthy: result.healthy,
        message: result.message || `${this.name} is ${result.healthy ? 'healthy' : 'unhealthy'}`,
        details: {
          ...result.details,
          service: this.name,
          version: this.version,
          state: this.state,
          uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
          checkDuration: duration,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${(error as Error).message}`,
        details: {
          service: this.name,
          version: this.version,
          state: this.state,
          error: (error as Error).message,
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Dispose service resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.log('info', `Disposing service ${this.name}...`);

    try {
      if (this.isRunning()) {
        await this.stop();
      }

      await this.onDispose();
      this.disposed = true;

      this.log('info', `Service ${this.name} disposed successfully`);
    } catch (error) {
      this.log('error', `Error disposing service ${this.name}`, error as Error);
      throw error;
    }
  }

  /**
   * Protected abstract methods to be implemented by subclasses
   */
  protected abstract onInitialize(): Promise<void>;
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onHealthCheck(): Promise<HealthCheckResult>;
  protected abstract onDispose(): Promise<void>;

  /**
   * Protected helper methods
   */
  protected setState(state: ServiceStatus['state']): void {
    const oldState = this.state;
    this.state = state;
    this.metadata.stateChanged = new Date();
    
    this.log('debug', `Service ${this.name} state changed: ${oldState} -> ${state}`);
  }

  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, error?: Error): void {
    if (!this.logger) return;

    const context = {
      module: this.name,
      metadata: { serviceId: this.id, version: this.version },
    };

    switch (level) {
      case 'debug':
        this.logger.debug(message, context);
        break;
      case 'info':
        this.logger.info(message, context);
        break;
      case 'warn':
        this.logger.warn(message, context);
        break;
      case 'error':
        this.logger.error(message, error, context);
        break;
    }
  }

  protected emitEvent(event: string, data?: any): void {
    if (!this.eventBus) return;

    this.eventBus.emit(event, {
      serviceId: this.id,
      serviceName: this.name,
      timestamp: new Date(),
      ...data,
    });
  }

  protected async checkDependencies(): Promise<void> {
    if (!this.config.dependencies || this.config.dependencies.length === 0) {
      return;
    }

    // This is a placeholder - actual implementation would check if dependencies are running
    this.log('debug', `Checking dependencies for ${this.name}: ${this.config.dependencies.join(', ')}`);
  }

  protected handleError(error: Error, operation: string): void {
    this.lastError = error;
    this.setState('error');
    
    this.log('error', `Error during ${operation} of service ${this.name}`, error);
    this.emitEvent(SystemEvents.SERVICE_ERROR, {
      service: this.name,
      operation,
      error: error.message,
    });
  }

  protected async handleStartError(error: Error): Promise<void> {
    this.handleError(error, 'starting');

    // Implement retry logic if configured
    if (this.config.retryPolicy && this.retryCount < this.config.retryPolicy.maxRetries) {
      this.retryCount++;
      const delay = this.calculateRetryDelay();
      
      this.log('info', `Retrying service ${this.name} start in ${delay}ms (attempt ${this.retryCount})`);
      
      setTimeout(async () => {
        if (!this.disposed && this.state === 'error') {
          this.setState('stopped');
          await this.start();
        }
      }, delay);
    } else {
      throw error;
    }
  }

  protected calculateRetryDelay(): number {
    if (!this.config.retryPolicy) return 0;

    const { retryDelay, backoffMultiplier = 1, maxDelay = 60000 } = this.config.retryPolicy;
    const delay = retryDelay * Math.pow(backoffMultiplier, this.retryCount - 1);
    
    return Math.min(delay, maxDelay);
  }

  protected mergeConfig(config?: Partial<ServiceConfig>): ServiceConfig {
    return {
      enabled: true,
      autoStart: false,
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 30000,
      },
      ...config,
    };
  }

  /**
   * Utility method to wait for a condition
   */
  protected async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout = 30000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (!(await condition())) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for condition in service ${this.name}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}