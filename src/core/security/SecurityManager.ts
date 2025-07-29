/**
 * Security Manager
 * Orchestrates all security features and provides a unified security interface
 */

import { logger } from '../../utils/logger';
import { RateLimiter, RateLimitPresets } from './RateLimiter';
import { AnomalyDetector, AnomalyEvent } from './AnomalyDetector';
import { InputValidator, ValidationSchema, ValidationResult } from './InputValidator';
import { AuditLogger, AuditEventType } from './AuditLogger';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    presets: typeof RateLimitPresets;
    custom?: Record<string, any>;
  };
  anomalyDetection: {
    enabled: boolean;
    patterns: string[];
    customPatterns?: any[];
  };
  inputValidation: {
    enabled: boolean;
    schemas: Record<string, ValidationSchema>;
  };
  auditLogging: {
    enabled: boolean;
    logDir?: string;
    retentionDays?: number;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
  };
  authentication: {
    sessionTimeout: number;
    maxFailedAttempts: number;
    lockoutDuration: number;
  };
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface SecurityCheckResult {
  allowed: boolean;
  reasons: string[];
  actions: string[];
  context?: any;
}

export class SecurityManager extends EventEmitter {
  private static instance: SecurityManager;
  private rateLimiter: RateLimiter;
  private anomalyDetector: AnomalyDetector;
  private inputValidator: InputValidator;
  private auditLogger: AuditLogger;
  private config: SecurityConfig;
  private sessions: Map<string, SecurityContext> = new Map();
  private failedAttempts: Map<string, number> = new Map();
  private lockedUsers: Map<string, Date> = new Map();

  private constructor(config?: Partial<SecurityConfig>) {
    super();
    
    this.config = {
      rateLimiting: {
        enabled: true,
        presets: RateLimitPresets,
        ...config?.rateLimiting
      },
      anomalyDetection: {
        enabled: true,
        patterns: ['sql-injection', 'xss-attempt', 'path-traversal'],
        ...config?.anomalyDetection
      },
      inputValidation: {
        enabled: true,
        schemas: {},
        ...config?.inputValidation
      },
      auditLogging: {
        enabled: true,
        retentionDays: 90,
        ...config?.auditLogging
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ...config?.encryption
      },
      authentication: {
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        maxFailedAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        ...config?.authentication
      }
    };

    // Initialize components
    this.rateLimiter = new RateLimiter();
    this.anomalyDetector = new AnomalyDetector();
    this.inputValidator = new InputValidator();
    this.auditLogger = new AuditLogger(config?.auditLogging);

    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<SecurityConfig>): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(config);
    }
    return SecurityManager.instance;
  }

  /**
   * Initialize security manager
   */
  private initialize(): void {
    // Set up anomaly detector listeners
    this.anomalyDetector.on('alert', (event: AnomalyEvent) => {
      this.handleSecurityAlert(event);
    });

    this.anomalyDetector.on('block', (event: AnomalyEvent) => {
      this.handleSecurityBlock(event);
    });

    // Log initialization
    logger.info('Security Manager initialized', {
      features: {
        rateLimiting: this.config.rateLimiting.enabled,
        anomalyDetection: this.config.anomalyDetection.enabled,
        inputValidation: this.config.inputValidation.enabled,
        auditLogging: this.config.auditLogging.enabled
      }
    });
  }

  /**
   * Perform comprehensive security check
   */
  public async checkSecurity(
    operation: string,
    data: any,
    context: SecurityContext
  ): Promise<SecurityCheckResult> {
    const result: SecurityCheckResult = {
      allowed: true,
      reasons: [],
      actions: []
    };

    try {
      // Check if user is locked out
      if (context.userId && this.isUserLocked(context.userId)) {
        result.allowed = false;
        result.reasons.push('User account is locked');
        result.actions.push('deny');
        return result;
      }

      // Rate limiting check
      if (this.config.rateLimiting.enabled) {
        const rateLimitKey = context.userId || context.ipAddress || 'anonymous';
        const rateLimitResult = await this.rateLimiter.checkLimit(
          rateLimitKey,
          this.config.rateLimiting.presets.normal
        );

        if (!rateLimitResult.allowed) {
          result.allowed = false;
          result.reasons.push('Rate limit exceeded');
          result.actions.push('rateLimit');
          result.context = { retryAfter: rateLimitResult.retryAfter };
        }
      }

      // Anomaly detection
      if (this.config.anomalyDetection.enabled && result.allowed) {
        const anomalies = await this.anomalyDetector.check(data, context);
        
        if (anomalies.length > 0) {
          for (const anomaly of anomalies) {
            result.reasons.push(`Anomaly detected: ${anomaly.pattern.name}`);
            
            if (anomaly.actions.some(a => a.type === 'block')) {
              result.allowed = false;
              result.actions.push('block');
            }
          }
        }
      }

      // Audit logging
      if (this.config.auditLogging.enabled) {
        await this.auditLogger.log({
          type: AuditEventType.SECURITY_EVENT,
          action: `security_check_${operation}`,
          userId: context.userId,
          ipAddress: context.ipAddress,
          result: result.allowed ? 'success' : 'failure',
          details: {
            reasons: result.reasons,
            actions: result.actions
          }
        });
      }

      return result;
    } catch (error) {
      logger.error('Error during security check:', error);
      
      // Fail secure - deny on error
      return {
        allowed: false,
        reasons: ['Security check error'],
        actions: ['error']
      };
    }
  }

  /**
   * Validate input data
   */
  public validateInput(
    data: any,
    schemaName: string
  ): ValidationResult {
    const schema = this.config.inputValidation.schemas[schemaName];
    
    if (!schema) {
      throw new Error(`Validation schema not found: ${schemaName}`);
    }

    return this.inputValidator.validate(data, schema);
  }

  /**
   * Create secure session
   */
  public createSession(context: SecurityContext): string {
    const sessionId = this.generateSessionId();
    
    this.sessions.set(sessionId, {
      ...context,
      sessionId,
      metadata: {
        ...context.metadata,
        createdAt: new Date(),
        lastActivity: new Date()
      }
    });

    // Audit log
    this.auditLogger.logAuthentication(
      context.userId || 'anonymous',
      'session_created',
      'success',
      { sessionId }
    );

    return sessionId;
  }

  /**
   * Validate session
   */
  public validateSession(sessionId: string): SecurityContext | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    const now = Date.now();
    const lastActivity = session.metadata?.lastActivity?.getTime() || 0;
    
    if (now - lastActivity > this.config.authentication.sessionTimeout) {
      this.destroySession(sessionId);
      return null;
    }

    // Update last activity
    session.metadata = {
      ...session.metadata,
      lastActivity: new Date()
    };

    return session;
  }

  /**
   * Destroy session
   */
  public destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      this.sessions.delete(sessionId);
      
      this.auditLogger.logAuthentication(
        session.userId || 'anonymous',
        'session_destroyed',
        'success',
        { sessionId }
      );
    }
  }

  /**
   * Record failed authentication attempt
   */
  public recordFailedAttempt(userId: string): void {
    const attempts = (this.failedAttempts.get(userId) || 0) + 1;
    this.failedAttempts.set(userId, attempts);

    this.auditLogger.logAuthentication(
      userId,
      'failed_login',
      'failure',
      { attempts }
    );

    if (attempts >= this.config.authentication.maxFailedAttempts) {
      this.lockUser(userId);
    }
  }

  /**
   * Reset failed attempts
   */
  public resetFailedAttempts(userId: string): void {
    this.failedAttempts.delete(userId);
  }

  /**
   * Lock user account
   */
  private lockUser(userId: string): void {
    const lockUntil = new Date(Date.now() + this.config.authentication.lockoutDuration);
    this.lockedUsers.set(userId, lockUntil);

    this.auditLogger.logSecurityEvent(
      'user_locked',
      'high',
      { userId, lockUntil }
    );

    this.emit('userLocked', { userId, lockUntil });
  }

  /**
   * Check if user is locked
   */
  private isUserLocked(userId: string): boolean {
    const lockUntil = this.lockedUsers.get(userId);
    
    if (!lockUntil) {
      return false;
    }

    if (new Date() > lockUntil) {
      this.lockedUsers.delete(userId);
      this.resetFailedAttempts(userId);
      return false;
    }

    return true;
  }

  /**
   * Encrypt sensitive data
   */
  public encrypt(data: string, key?: Buffer): { encrypted: string; iv: string; tag: string } {
    const encryptionKey = key || crypto.randomBytes(this.config.encryption.keyLength);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(
      this.config.encryption.algorithm,
      encryptionKey,
      iv
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = (cipher as any).getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  public decrypt(
    encryptedData: string,
    key: Buffer,
    iv: string,
    tag: string
  ): string {
    const decipher = crypto.createDecipheriv(
      this.config.encryption.algorithm,
      key,
      Buffer.from(iv, 'hex')
    );

    (decipher as any).setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate secure token
   */
  public generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash password
   */
  public async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password
   */
  public async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  /**
   * Create security middleware
   */
  public middleware(options: {
    requireAuth?: boolean;
    requiredPermissions?: string[];
    rateLimit?: keyof typeof RateLimitPresets;
    validateInput?: string;
  } = {}) {
    return async (req: any, res: any, next: any) => {
      try {
        // Extract context
        const context: SecurityContext = {
          userId: req.user?.id,
          sessionId: req.session?.id || req.headers['x-session-id'],
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          permissions: req.user?.permissions
        };

        // Validate session if required
        if (options.requireAuth) {
          const session = this.validateSession(context.sessionId || '');
          if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
          context.userId = session.userId;
          context.permissions = session.permissions;
        }

        // Check permissions
        if (options.requiredPermissions) {
          const hasPermission = options.requiredPermissions.every(
            perm => context.permissions?.includes(perm)
          );
          
          if (!hasPermission) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        }

        // Rate limiting
        if (options.rateLimit) {
          const rateLimitKey = context.userId || context.ipAddress || 'anonymous';
          const rateLimitResult = await this.rateLimiter.checkLimit(
            rateLimitKey,
            this.config.rateLimiting.presets[options.rateLimit]
          );

          res.setHeader('X-RateLimit-Limit', rateLimitResult.limit.toString());
          res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
          res.setHeader('X-RateLimit-Reset', rateLimitResult.resetAt.toISOString());

          if (!rateLimitResult.allowed) {
            res.setHeader('Retry-After', rateLimitResult.retryAfter!.toString());
            return res.status(429).json({ error: 'Too Many Requests' });
          }
        }

        // Input validation
        if (options.validateInput) {
          const validationResult = this.validateInput(req.body, options.validateInput);
          
          if (!validationResult.valid) {
            return res.status(400).json({
              error: 'Validation failed',
              errors: validationResult.errors
            });
          }
          
          req.body = validationResult.sanitized;
        }

        // Security check
        const securityResult = await this.checkSecurity(
          req.method + ' ' + req.path,
          { body: req.body, query: req.query },
          context
        );

        if (!securityResult.allowed) {
          return res.status(403).json({
            error: 'Security check failed',
            reasons: securityResult.reasons
          });
        }

        // Attach context to request
        req.securityContext = context;

        next();
      } catch (error) {
        logger.error('Security middleware error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    };
  }

  /**
   * Handle security alert
   */
  private handleSecurityAlert(event: AnomalyEvent): void {
    logger.error('SECURITY ALERT', {
      pattern: event.pattern.name,
      severity: event.pattern.severity,
      data: event.data
    });

    this.emit('securityAlert', event);
  }

  /**
   * Handle security block
   */
  private handleSecurityBlock(event: AnomalyEvent): void {
    logger.error('SECURITY BLOCK', {
      pattern: event.pattern.name,
      severity: event.pattern.severity
    });

    this.emit('securityBlock', event);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Get security statistics
   */
  public async getStatistics(): Promise<any> {
    return {
      rateLimiter: {
        active: true,
        presets: Object.keys(this.config.rateLimiting.presets)
      },
      anomalyDetector: this.anomalyDetector.getStatistics(),
      sessions: {
        active: this.sessions.size,
        lockedUsers: this.lockedUsers.size
      },
      audit: await this.auditLogger.generateReport(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date()
      )
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Security configuration updated');
  }

  /**
   * Get configuration
   */
  public getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();