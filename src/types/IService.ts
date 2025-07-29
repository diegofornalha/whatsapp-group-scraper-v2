/**
 * Base service interface for all services in the application
 */
export interface IService {
  /**
   * Service unique identifier
   */
  readonly id: string;

  /**
   * Service name for identification
   */
  readonly name: string;

  /**
   * Service version
   */
  readonly version: string;

  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Start the service
   */
  start(): Promise<void>;

  /**
   * Stop the service
   */
  stop(): Promise<void>;

  /**
   * Check if service is running
   */
  isRunning(): boolean;

  /**
   * Get service status
   */
  getStatus(): ServiceStatus;

  /**
   * Service health check
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Dispose service resources
   */
  dispose(): Promise<void>;
}

export interface ServiceStatus {
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  uptime?: number;
  lastError?: Error;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface ServiceConfig {
  enabled: boolean;
  autoStart: boolean;
  retryPolicy?: RetryPolicy;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
  maxDelay?: number;
}