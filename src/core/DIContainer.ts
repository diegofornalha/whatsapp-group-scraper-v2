/**
 * Dependency Injection Container
 * Provides a lightweight, type-safe dependency injection system
 */

export type Constructor<T = {}> = new (...args: any[]) => T;
export type Factory<T> = (container: DIContainer) => T | Promise<T>;
export type Token<T> = symbol | string | Constructor<T>;

export interface ServiceDescriptor<T = any> {
  token: Token<T>;
  useClass?: Constructor<T>;
  useValue?: T;
  useFactory?: Factory<T>;
  useExisting?: Token<T>;
  singleton?: boolean;
  dependencies?: Token<any>[];
  metadata?: Record<string, any>;
}

export interface DIContainerOptions {
  parent?: DIContainer;
  autoRegister?: boolean;
  enableLogging?: boolean;
}

export class DIContainer {
  private services = new Map<Token<any>, ServiceDescriptor>();
  private instances = new Map<Token<any>, any>();
  private resolving = new Set<Token<any>>();
  private parent?: DIContainer;
  private options: Required<DIContainerOptions>;

  constructor(options: DIContainerOptions = {}) {
    this.parent = options.parent;
    this.options = {
      parent: options.parent,
      autoRegister: options.autoRegister ?? false,
      enableLogging: options.enableLogging ?? false,
    };
  }

  /**
   * Register a service
   */
  register<T>(descriptor: ServiceDescriptor<T>): this {
    if (this.options.enableLogging) {
      console.log(`Registering service: ${this.tokenToString(descriptor.token)}`);
    }

    this.services.set(descriptor.token, descriptor);
    
    // Clear any existing instance if re-registering
    this.instances.delete(descriptor.token);
    
    return this;
  }

  /**
   * Register a class
   */
  registerClass<T>(
    token: Token<T>,
    constructor: Constructor<T>,
    options?: { singleton?: boolean; dependencies?: Token<any>[] }
  ): this {
    return this.register({
      token,
      useClass: constructor,
      singleton: options?.singleton ?? true,
      dependencies: options?.dependencies,
    });
  }

  /**
   * Register a value
   */
  registerValue<T>(token: Token<T>, value: T): this {
    return this.register({
      token,
      useValue: value,
      singleton: true,
    });
  }

  /**
   * Register a factory
   */
  registerFactory<T>(
    token: Token<T>,
    factory: Factory<T>,
    options?: { singleton?: boolean }
  ): this {
    return this.register({
      token,
      useFactory: factory,
      singleton: options?.singleton ?? false,
    });
  }

  /**
   * Register with decorator metadata (for use with decorators)
   */
  registerWithMetadata<T>(constructor: Constructor<T>): this {
    const metadata = Reflect.getMetadata('design:paramtypes', constructor) || [];
    const dependencies = metadata.map((type: any, index: number) => {
      // Check for custom inject metadata
      const injectToken = Reflect.getMetadata('inject', constructor, index);
      return injectToken || type;
    });

    return this.registerClass(constructor, constructor, { dependencies });
  }

  /**
   * Resolve a service
   */
  async resolve<T>(token: Token<T>): Promise<T> {
    // Check for circular dependencies
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected: ${this.tokenToString(token)}`);
    }

    // Check if instance already exists
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check if service is registered
    const descriptor = this.services.get(token);
    if (!descriptor) {
      // Try parent container
      if (this.parent) {
        return this.parent.resolve(token);
      }

      // Auto-register if enabled and token is a constructor
      if (this.options.autoRegister && typeof token === 'function') {
        this.registerWithMetadata(token as Constructor<T>);
        return this.resolve(token);
      }

      throw new Error(`Service not registered: ${this.tokenToString(token)}`);
    }

    this.resolving.add(token);

    try {
      let instance: T;

      if (descriptor.useValue !== undefined) {
        instance = descriptor.useValue;
      } else if (descriptor.useFactory) {
        instance = await descriptor.useFactory(this);
      } else if (descriptor.useExisting) {
        instance = await this.resolve(descriptor.useExisting);
      } else if (descriptor.useClass) {
        instance = await this.createInstance(descriptor.useClass, descriptor.dependencies);
      } else {
        throw new Error(`Invalid service descriptor for: ${this.tokenToString(token)}`);
      }

      // Store instance if singleton
      if (descriptor.singleton !== false) {
        this.instances.set(token, instance);
      }

      if (this.options.enableLogging) {
        console.log(`Resolved service: ${this.tokenToString(token)}`);
      }

      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  /**
   * Resolve a service synchronously (throws if async resolution is needed)
   */
  resolveSync<T>(token: Token<T>): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const descriptor = this.services.get(token);
    if (!descriptor) {
      if (this.parent) {
        return this.parent.resolveSync(token);
      }
      throw new Error(`Service not registered: ${this.tokenToString(token)}`);
    }

    if (descriptor.useFactory) {
      throw new Error(`Cannot resolve factory synchronously: ${this.tokenToString(token)}`);
    }

    // For sync resolution, we can't use async factories
    const result = this.resolve(token);
    if (result instanceof Promise) {
      throw new Error(`Cannot resolve async service synchronously: ${this.tokenToString(token)}`);
    }

    return result as T;
  }

  /**
   * Check if a service is registered
   */
  has(token: Token<any>): boolean {
    return this.services.has(token) || (this.parent?.has(token) ?? false);
  }

  /**
   * Get all registered services
   */
  getServices(): Token<any>[] {
    const services = Array.from(this.services.keys());
    if (this.parent) {
      services.push(...this.parent.getServices());
    }
    return Array.from(new Set(services));
  }

  /**
   * Clear all services and instances
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
    this.resolving.clear();
  }

  /**
   * Create a child container
   */
  createChild(): DIContainer {
    return new DIContainer({
      parent: this,
      autoRegister: this.options.autoRegister,
      enableLogging: this.options.enableLogging,
    });
  }

  /**
   * Dispose of all singleton instances
   */
  async dispose(): Promise<void> {
    for (const [token, instance] of this.instances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          await instance.dispose();
        } catch (error) {
          console.error(`Error disposing ${this.tokenToString(token)}:`, error);
        }
      }
    }
    this.clear();
  }

  /**
   * Private helper methods
   */
  private async createInstance<T>(
    constructor: Constructor<T>,
    dependencies?: Token<any>[]
  ): Promise<T> {
    const deps = dependencies || this.getDependencies(constructor);
    const resolvedDeps = await Promise.all(deps.map(dep => this.resolve(dep)));
    return new constructor(...resolvedDeps);
  }

  private getDependencies(constructor: Constructor<any>): Token<any>[] {
    // Try to get dependencies from Reflect metadata
    const types = Reflect.getMetadata('design:paramtypes', constructor) || [];
    return types.map((type: any, index: number) => {
      // Check for custom inject metadata
      const injectToken = Reflect.getMetadata('inject', constructor, index);
      return injectToken || type;
    });
  }

  private tokenToString(token: Token<any>): string {
    if (typeof token === 'symbol') {
      return token.toString();
    }
    if (typeof token === 'string') {
      return token;
    }
    if (typeof token === 'function') {
      return token.name || 'Anonymous';
    }
    return String(token);
  }
}

// Global container instance
export const globalContainer = new DIContainer({
  autoRegister: true,
  enableLogging: process.env.NODE_ENV === 'development',
});

// Decorators for easier usage (requires reflect-metadata)
export function Injectable(options?: { singleton?: boolean }) {
  return function <T extends Constructor>(target: T) {
    globalContainer.registerWithMetadata(target);
    if (options?.singleton !== undefined) {
      const descriptor = globalContainer['services'].get(target);
      if (descriptor) {
        descriptor.singleton = options.singleton;
      }
    }
    return target;
  };
}

export function Inject(token: Token<any>) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata('inject', token, target, parameterIndex);
  };
}

// Service tokens for common services
export const SERVICE_TOKENS = {
  Logger: Symbol('Logger'),
  EventBus: Symbol('EventBus'),
  Config: Symbol('Config'),
  Storage: Symbol('Storage'),
  Extractor: Symbol('Extractor'),
  WhatsAppClient: Symbol('WhatsAppClient'),
} as const;