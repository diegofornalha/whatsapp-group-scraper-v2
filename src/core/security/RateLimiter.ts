/**
 * Rate Limiter Implementation
 * Prevents abuse and excessive API calls
 */

import { logger } from '../../utils/logger';

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  keyPrefix?: string;    // Redis key prefix
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export class RateLimiter {
  private stores: Map<string, Map<string, { count: number; resetAt: number }>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request is allowed based on rate limit
   */
  public async checkLimit(
    key: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const storeKey = `${options.keyPrefix || 'rl'}:${key}`;
    
    // Get or create store for this prefix
    if (!this.stores.has(options.keyPrefix || 'rl')) {
      this.stores.set(options.keyPrefix || 'rl', new Map());
    }
    
    const store = this.stores.get(options.keyPrefix || 'rl')!;
    const entry = store.get(key);
    
    // Calculate reset time
    const resetAt = now + options.windowMs;
    
    // Check if we have an existing entry
    if (entry && entry.resetAt > now) {
      // Still within the window
      const remaining = options.maxRequests - entry.count;
      
      if (remaining <= 0) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        
        logger.warn('Rate limit exceeded', {
          key: storeKey,
          limit: options.maxRequests,
          window: options.windowMs,
          retryAfter
        });
        
        return {
          allowed: false,
          limit: options.maxRequests,
          remaining: 0,
          resetAt: new Date(entry.resetAt),
          retryAfter
        };
      }
      
      // Increment counter
      entry.count++;
      
      return {
        allowed: true,
        limit: options.maxRequests,
        remaining: remaining - 1,
        resetAt: new Date(entry.resetAt)
      };
    }
    
    // Create new entry
    store.set(key, {
      count: 1,
      resetAt
    });
    
    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      resetAt: new Date(resetAt)
    };
  }

  /**
   * Create middleware for Express/Koa style frameworks
   */
  public middleware(options: RateLimitOptions) {
    return async (req: any, res: any, next: any) => {
      // Extract identifier (IP, user ID, API key, etc.)
      const key = this.extractKey(req);
      
      const result = await this.checkLimit(key, options);
      
      // Set headers
      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
      
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter!.toString());
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter
        });
        return;
      }
      
      next();
    };
  }

  /**
   * Extract identifier from request
   */
  private extractKey(req: any): string {
    // Priority: User ID > API Key > IP Address
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    
    if (req.headers['x-api-key']) {
      return `api:${req.headers['x-api-key']}`;
    }
    
    // Extract IP address
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               'unknown';
    
    return `ip:${ip}`;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [prefix, store] of this.stores) {
      for (const [key, entry] of store) {
        if (entry.resetAt <= now) {
          store.delete(key);
          cleaned++;
        }
      }
      
      // Remove empty stores
      if (store.size === 0) {
        this.stores.delete(prefix);
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Reset rate limit for specific key
   */
  public reset(key: string, prefix?: string): void {
    const store = this.stores.get(prefix || 'rl');
    if (store) {
      store.delete(key);
    }
  }

  /**
   * Get current usage for key
   */
  public getUsage(key: string, prefix?: string): { count: number; resetAt: Date } | null {
    const store = this.stores.get(prefix || 'rl');
    const entry = store?.get(key);
    
    if (!entry || entry.resetAt <= Date.now()) {
      return null;
    }
    
    return {
      count: entry.count,
      resetAt: new Date(entry.resetAt)
    };
  }

  /**
   * Destroy rate limiter and cleanup
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.stores.clear();
  }
}

// Predefined rate limit configurations
export const RateLimitPresets = {
  // Strict: 10 requests per minute
  strict: {
    windowMs: 60 * 1000,
    maxRequests: 10
  },
  
  // Normal: 60 requests per minute
  normal: {
    windowMs: 60 * 1000,
    maxRequests: 60
  },
  
  // Relaxed: 300 requests per minute
  relaxed: {
    windowMs: 60 * 1000,
    maxRequests: 300
  },
  
  // API: 1000 requests per hour
  api: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 1000
  },
  
  // Auth: 5 attempts per 15 minutes
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5
  }
};

// Export singleton instance
export const rateLimiter = new RateLimiter();