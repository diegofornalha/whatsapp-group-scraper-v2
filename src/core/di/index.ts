/**
 * Dependency Injection module exports
 */

export * from './Container';
export * from './tokens';
export * from './bootstrap';

// Re-export commonly used items
export { defaultContainer as container } from './Container';
export { 
  Injectable, 
  Inject, 
  ServiceLocator,
  Lifecycle,
  type Token,
  type Factory,
  type ServiceDescriptor
} from './Container';