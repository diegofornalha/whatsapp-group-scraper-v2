/**
 * Core module exports
 * Central export point for all core services and utilities
 */

// Event Bus
export { EventBus, globalEventBus, SystemEvents } from './EventBus';
export type { EventHandler, EventUnsubscribe, EventSubscription, EventBusOptions } from './EventBus';

// Dependency Injection Container
export { DIContainer, globalContainer, Injectable, Inject, SERVICE_TOKENS } from './DIContainer';
export type { Constructor, Factory, Token, ServiceDescriptor, DIContainerOptions } from './DIContainer';

// Configuration Service
export { ConfigService } from './ConfigService';

// Base Service
export { BaseService } from './BaseService';

// Service Registry
export { ServiceRegistry } from './ServiceRegistry';

// Error handling
export {
  AppError,
  ServiceError,
  ServiceNotFoundError,
  ServiceAlreadyExistsError,
  ServiceStartError,
  ConfigError,
  ConfigValidationError,
  WhatsAppError,
  WhatsAppConnectionError,
  WhatsAppAuthenticationError,
  WhatsAppQRCodeError,
  ExtractionError,
  GroupNotFoundError,
  MemberNotFoundError,
  ExtractionTimeoutError,
  StorageError,
  StorageConnectionError,
  StorageOperationError,
  ExportError,
  ExportFormatError,
  ExportSizeError,
  ValidationError,
  RateLimitError,
  ErrorHandler,
  ErrorEmitter,
  RetryStrategy,
} from './errors';
export type { RecoveryStrategy } from './errors';

// Re-export types from types directory
export * from '../types';