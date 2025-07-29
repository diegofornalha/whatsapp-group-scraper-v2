/**
 * Dependency Injection Container
 * 
 * Provides a lightweight IoC container for managing dependencies
 * throughout the application lifecycle.
 */

import { IService, ServiceConfig } from '../../types';

/**
 * Token type for dependency injection
 */
export type Token<T = any> = string | Symbol | { new(...args: any[]): T };

/**
 * Service descriptor for registration
 */
export interface ServiceDescriptor<T = any> {
  token: Token<T>;
  factory: Factory<T>;
  lifecycle: Lifecycle;
  config?: ServiceConfig;
  dependencies?: Token[];
}

/**
 * Factory function type
 */
export type Factory<T> = (container: Container) => T | Promise<T>;

/**
 * Service lifecycle types
 */
export enum Lifecycle {
  SINGLETON = 'singleton',
  TRANSIENT = 'transient',
  SCOPED = 'scoped'
}

/**
 * Dependency injection container
 */
export class Container {
  private services = new Map<Token, ServiceDescriptor>();
  private singletons = new Map<Token, any>();
  private scopedInstances = new WeakMap<object, Map<Token, any>>();
  private currentScope: object | null = null;
  private resolving = new Set<Token>();

  /**
   * Register a service with the container
   */
  register<T>(descriptor: ServiceDescriptor<T>): this {
    this.services.set(descriptor.token, descriptor);
    return this;
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    token: Token<T>,
    factory: Factory<T>,
    config?: ServiceConfig
  ): this {
    return this.register({
      token,
      factory,
      lifecycle: Lifecycle.SINGLETON,
      config
    });
  }

  /**
   * Register a transient service
   */
  registerTransient<T>(
    token: Token<T>,
    factory: Factory<T>,
    config?: ServiceConfig
  ): this {
    return this.register({
      token,
      factory,
      lifecycle: Lifecycle.TRANSIENT,
      config
    });
  }

  /**
   * Register a scoped service
   */
  registerScoped<T>(
    token: Token<T>,
    factory: Factory<T>,
    config?: ServiceConfig
  ): this {
    return this.register({
      token,
      factory,
      lifecycle: Lifecycle.SCOPED,
      config
    });
  }

  /**
   * Register a class with automatic dependency injection
   */
  registerClass<T>(
    token: Token<T>,
    constructor: new (...args: any[]) => T,
    lifecycle: Lifecycle = Lifecycle.SINGLETON,
    config?: ServiceConfig
  ): this {
    const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];
    const dependencies = paramTypes.map((type: any, index: number) => {
      const token = Reflect.getMetadata('inject', constructor, index);
      return token || type;
    });

    return this.register({
      token,
      factory: (container) => {
        const args = dependencies.map((dep: Token) => container.resolve(dep));
        return new constructor(...args);
      },
      lifecycle,
      config,
      dependencies
    });
  }

  /**
   * Resolve a service from the container
   */
  async resolve<T>(token: Token<T>): Promise<T> {
    // Check for circular dependencies
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected: ${this.getTokenName(token)}`);
    }

    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${this.getTokenName(token)}`);
    }

    this.resolving.add(token);

    try {
      switch (descriptor.lifecycle) {
        case Lifecycle.SINGLETON:
          return await this.resolveSingleton(descriptor);
        case Lifecycle.TRANSIENT:
          return await this.resolveTransient(descriptor);
        case Lifecycle.SCOPED:
          return await this.resolveScoped(descriptor);
        default:
          throw new Error(`Unknown lifecycle: ${descriptor.lifecycle}`);
      }
    } finally {
      this.resolving.delete(token);
    }
  }

  /**
   * Resolve a singleton service
   */
  private async resolveSingleton<T>(descriptor: ServiceDescriptor<T>): Promise<T> {
    if (!this.singletons.has(descriptor.token)) {
      const instance = await descriptor.factory(this);
      this.singletons.set(descriptor.token, instance);
      
      // Initialize if it's a service
      if (this.isService(instance) && descriptor.config?.autoStart) {
        await instance.initialize();
        await instance.start();
      }
    }
    return this.singletons.get(descriptor.token);
  }

  /**
   * Resolve a transient service
   */
  private async resolveTransient<T>(descriptor: ServiceDescriptor<T>): Promise<T> {
    const instance = await descriptor.factory(this);
    
    // Initialize if it's a service
    if (this.isService(instance) && descriptor.config?.autoStart) {
      await instance.initialize();
      await instance.start();
    }
    
    return instance;
  }

  /**
   * Resolve a scoped service
   */
  private async resolveScoped<T>(descriptor: ServiceDescriptor<T>): Promise<T> {
    if (!this.currentScope) {
      throw new Error('No active scope for scoped service resolution');
    }

    let scopeMap = this.scopedInstances.get(this.currentScope);
    if (!scopeMap) {
      scopeMap = new Map();
      this.scopedInstances.set(this.currentScope, scopeMap);
    }

    if (!scopeMap.has(descriptor.token)) {
      const instance = await descriptor.factory(this);
      scopeMap.set(descriptor.token, instance);
      
      // Initialize if it's a service
      if (this.isService(instance) && descriptor.config?.autoStart) {
        await instance.initialize();
        await instance.start();
      }
    }

    return scopeMap.get(descriptor.token);
  }

  /**
   * Create a new scope
   */
  createScope(): object {
    return {};
  }

  /**
   * Execute a function within a scope
   */
  async runInScope<T>(scope: object, fn: () => T | Promise<T>): Promise<T> {
    const previousScope = this.currentScope;
    this.currentScope = scope;
    try {
      return await fn();
    } finally {
      this.currentScope = previousScope;
    }
  }

  /**
   * Check if a service is registered
   */
  has(token: Token): boolean {
    return this.services.has(token);
  }

  /**
   * Get all registered services
   */
  getServices(): Token[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service descriptor
   */
  getDescriptor(token: Token): ServiceDescriptor | undefined {
    return this.services.get(token);
  }

  /**
   * Clear all services
   */
  async clear(): Promise<void> {
    // Stop and dispose all singleton services
    for (const [token, instance] of this.singletons) {
      if (this.isService(instance)) {
        await instance.stop();
        await instance.dispose();
      }
    }

    this.services.clear();
    this.singletons.clear();
    this.scopedInstances = new WeakMap();
    this.currentScope = null;
    this.resolving.clear();
  }

  /**
   * Check if an instance is a service
   */
  private isService(instance: any): instance is IService {
    return (
      instance &&
      typeof instance.initialize === 'function' &&
      typeof instance.start === 'function' &&
      typeof instance.stop === 'function' &&
      typeof instance.dispose === 'function'
    );
  }

  /**
   * Get token name for error messages
   */
  private getTokenName(token: Token): string {
    if (typeof token === 'string') return token;
    if (typeof token === 'symbol') return token.toString();
    if (typeof token === 'function') return token.name;
    return String(token);
  }
}

/**
 * Default container instance
 */
export const defaultContainer = new Container();

/**
 * Decorator to mark a class as injectable
 */
export function Injectable(lifecycle: Lifecycle = Lifecycle.SINGLETON) {
  return function (target: any) {
    Reflect.defineMetadata('injectable', true, target);
    Reflect.defineMetadata('lifecycle', lifecycle, target);
    return target;
  };
}

/**
 * Decorator to inject a dependency
 */
export function Inject(token: Token) {
  return function (target: any, propertyKey: string | symbol, parameterIndex?: number) {
    if (parameterIndex !== undefined) {
      // Constructor parameter injection
      Reflect.defineMetadata('inject', token, target, parameterIndex);
    } else {
      // Property injection
      const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
      if (!descriptor) {
        Object.defineProperty(target, propertyKey, {
          get() {
            return defaultContainer.resolve(token);
          },
          enumerable: true,
          configurable: true
        });
      }
    }
  };
}

/**
 * Service locator pattern (use sparingly)
 */
export class ServiceLocator {
  private static container: Container = defaultContainer;

  static setContainer(container: Container): void {
    ServiceLocator.container = container;
  }

  static async get<T>(token: Token<T>): Promise<T> {
    return ServiceLocator.container.resolve(token);
  }

  static has(token: Token): boolean {
    return ServiceLocator.container.has(token);
  }
}