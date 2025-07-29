/**
 * EventBus for inter-module communication
 * Implements a type-safe event system with support for wildcards and async handlers
 */

export type EventHandler<T = any> = (data: T) => void | Promise<void>;
export type EventUnsubscribe = () => void;

export interface EventSubscription {
  id: string;
  event: string;
  handler: EventHandler;
  once: boolean;
  priority: number;
}

export interface EventBusOptions {
  maxListeners?: number;
  wildcardDelimiter?: string;
  enableLogging?: boolean;
  asyncHandlers?: boolean;
}

export class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private wildcardSubscriptions: EventSubscription[] = [];
  private eventHistory: Array<{ event: string; data: any; timestamp: Date }> = [];
  private options: Required<EventBusOptions>;
  private subscriptionIdCounter = 0;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners ?? 100,
      wildcardDelimiter: options.wildcardDelimiter ?? '.',
      enableLogging: options.enableLogging ?? false,
      asyncHandlers: options.asyncHandlers ?? true,
    };
  }

  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, handler: EventHandler<T>, priority = 0): EventUnsubscribe {
    return this.addSubscription(event, handler, false, priority);
  }

  /**
   * Subscribe to an event once
   */
  once<T = any>(event: string, handler: EventHandler<T>, priority = 0): EventUnsubscribe {
    return this.addSubscription(event, handler, true, priority);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      // Remove all handlers for this event
      this.subscriptions.delete(event);
      this.wildcardSubscriptions = this.wildcardSubscriptions.filter(
        sub => !this.matchWildcard(event, sub.event)
      );
      return;
    }

    // Remove specific handler
    const subs = this.subscriptions.get(event);
    if (subs) {
      const filtered = subs.filter(sub => sub.handler !== handler);
      if (filtered.length > 0) {
        this.subscriptions.set(event, filtered);
      } else {
        this.subscriptions.delete(event);
      }
    }

    // Remove from wildcard subscriptions
    this.wildcardSubscriptions = this.wildcardSubscriptions.filter(
      sub => !(this.matchWildcard(event, sub.event) && sub.handler === handler)
    );
  }

  /**
   * Emit an event
   */
  async emit<T = any>(event: string, data?: T): Promise<void> {
    if (this.options.enableLogging) {
      this.eventHistory.push({ event, data, timestamp: new Date() });
    }

    const handlers: EventSubscription[] = [];

    // Get exact match handlers
    const exactHandlers = this.subscriptions.get(event) || [];
    handlers.push(...exactHandlers);

    // Get wildcard match handlers
    const wildcardHandlers = this.wildcardSubscriptions.filter(sub =>
      this.matchWildcard(event, sub.event)
    );
    handlers.push(...wildcardHandlers);

    // Sort by priority (higher priority first)
    handlers.sort((a, b) => b.priority - a.priority);

    // Execute handlers
    const promises: Promise<void>[] = [];

    for (const sub of handlers) {
      if (sub.once) {
        this.removeSubscription(sub);
      }

      if (this.options.asyncHandlers) {
        promises.push(this.executeHandler(sub.handler, data));
      } else {
        await this.executeHandler(sub.handler, data);
      }
    }

    if (this.options.asyncHandlers) {
      await Promise.all(promises);
    }
  }

  /**
   * Emit an event synchronously
   */
  emitSync<T = any>(event: string, data?: T): void {
    const originalAsync = this.options.asyncHandlers;
    this.options.asyncHandlers = false;
    
    this.emit(event, data).catch(error => {
      console.error(`Error in sync emit for event ${event}:`, error);
    });
    
    this.options.asyncHandlers = originalAsync;
  }

  /**
   * Wait for an event
   */
  waitFor<T = any>(event: string, timeout?: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            this.off(event, handler);
            reject(new Error(`Timeout waiting for event: ${event}`));
          }, timeout)
        : null;

      const handler = (data: T) => {
        if (timer) clearTimeout(timer);
        resolve(data);
      };

      this.once(event, handler);
    });
  }

  /**
   * Get all listeners for an event
   */
  listeners(event: string): EventHandler[] {
    const handlers: EventHandler[] = [];
    
    const exact = this.subscriptions.get(event) || [];
    handlers.push(...exact.map(sub => sub.handler));
    
    const wildcard = this.wildcardSubscriptions.filter(sub =>
      this.matchWildcard(event, sub.event)
    );
    handlers.push(...wildcard.map(sub => sub.handler));
    
    return handlers;
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: string): number {
    return this.listeners(event).length;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.subscriptions.delete(event);
      this.wildcardSubscriptions = this.wildcardSubscriptions.filter(
        sub => !this.matchWildcard(event, sub.event)
      );
    } else {
      this.subscriptions.clear();
      this.wildcardSubscriptions = [];
    }
  }

  /**
   * Get event history
   */
  getEventHistory(limit?: number): Array<{ event: string; data: any; timestamp: Date }> {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Private helper methods
   */
  private addSubscription(
    event: string,
    handler: EventHandler,
    once: boolean,
    priority: number
  ): EventUnsubscribe {
    const subscription: EventSubscription = {
      id: this.generateSubscriptionId(),
      event,
      handler,
      once,
      priority,
    };

    if (event.includes('*') || event.includes('?')) {
      this.wildcardSubscriptions.push(subscription);
    } else {
      const subs = this.subscriptions.get(event) || [];
      
      if (subs.length >= this.options.maxListeners) {
        console.warn(
          `Max listeners (${this.options.maxListeners}) exceeded for event: ${event}`
        );
      }
      
      subs.push(subscription);
      this.subscriptions.set(event, subs);
    }

    return () => this.removeSubscription(subscription);
  }

  private removeSubscription(subscription: EventSubscription): void {
    const subs = this.subscriptions.get(subscription.event);
    if (subs) {
      const filtered = subs.filter(sub => sub.id !== subscription.id);
      if (filtered.length > 0) {
        this.subscriptions.set(subscription.event, filtered);
      } else {
        this.subscriptions.delete(subscription.event);
      }
    }

    this.wildcardSubscriptions = this.wildcardSubscriptions.filter(
      sub => sub.id !== subscription.id
    );
  }

  private async executeHandler(handler: EventHandler, data: any): Promise<void> {
    try {
      await handler(data);
    } catch (error) {
      console.error('Error in event handler:', error);
      this.emit('error', { error, handler: handler.toString(), data });
    }
  }

  private matchWildcard(event: string, pattern: string): boolean {
    if (!pattern.includes('*') && !pattern.includes('?')) {
      return event === pattern;
    }

    const regexPattern = pattern
      .split(this.options.wildcardDelimiter)
      .map(part => {
        if (part === '*') return '[^' + this.options.wildcardDelimiter + ']+';
        if (part === '**') return '.*';
        if (part.includes('?')) return part.replace(/\?/g, '.');
        return part;
      })
      .join('\\' + this.options.wildcardDelimiter);

    const regex = new RegExp('^' + regexPattern + '$');
    return regex.test(event);
  }

  private generateSubscriptionId(): string {
    return `sub_${++this.subscriptionIdCounter}_${Date.now()}`;
  }
}

// Singleton instance
export const globalEventBus = new EventBus({
  enableLogging: true,
  maxListeners: 200,
});

// Export common event types
export enum SystemEvents {
  // Service events
  SERVICE_STARTED = 'service.started',
  SERVICE_STOPPED = 'service.stopped',
  SERVICE_ERROR = 'service.error',
  SERVICE_HEALTH_CHECK = 'service.health_check',

  // WhatsApp events
  WHATSAPP_READY = 'whatsapp.ready',
  WHATSAPP_QR = 'whatsapp.qr',
  WHATSAPP_AUTHENTICATED = 'whatsapp.authenticated',
  WHATSAPP_DISCONNECTED = 'whatsapp.disconnected',
  WHATSAPP_MESSAGE = 'whatsapp.message',

  // Extraction events
  EXTRACTION_STARTED = 'extraction.started',
  EXTRACTION_PROGRESS = 'extraction.progress',
  EXTRACTION_COMPLETED = 'extraction.completed',
  EXTRACTION_ERROR = 'extraction.error',

  // Export events
  EXPORT_STARTED = 'export.started',
  EXPORT_COMPLETED = 'export.completed',
  EXPORT_ERROR = 'export.error',

  // System events
  CONFIG_CHANGED = 'config.changed',
  ERROR = 'error',
  WARNING = 'warning',
}