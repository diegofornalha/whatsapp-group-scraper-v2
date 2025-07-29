/**
 * Secure Data Handler
 * Implements secure patterns for handling sensitive data
 */

import { logger } from '../../utils/logger';
import * as crypto from 'crypto';

export interface SecureDataOptions {
  encryption?: boolean;
  masking?: boolean;
  tokenization?: boolean;
  hashing?: boolean;
}

export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  tags?: string[];
  handling?: SecureDataOptions;
}

export class SecureDataHandler {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly HASH_ALGORITHM = 'sha256';
  private static readonly SALT_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  
  private tokenStore: Map<string, any> = new Map();
  private encryptionKey: Buffer;

  constructor(encryptionKey?: Buffer) {
    this.encryptionKey = encryptionKey || crypto.randomBytes(32);
  }

  /**
   * Classify data based on content
   */
  public classifyData(data: any): DataClassification {
    const dataStr = JSON.stringify(data).toLowerCase();
    
    // Check for highly sensitive patterns
    if (this.containsSensitivePatterns(dataStr, ['ssn', 'social security', 'tax id', 'passport'])) {
      return { level: 'restricted', handling: { encryption: true, masking: true } };
    }
    
    // Check for confidential patterns
    if (this.containsSensitivePatterns(dataStr, ['credit card', 'bank account', 'password', 'api key'])) {
      return { level: 'confidential', handling: { encryption: true, tokenization: true } };
    }
    
    // Check for internal patterns
    if (this.containsSensitivePatterns(dataStr, ['email', 'phone', 'address', 'name'])) {
      return { level: 'internal', handling: { masking: true } };
    }
    
    return { level: 'public', handling: {} };
  }

  /**
   * Handle data securely based on classification
   */
  public async handleData(data: any, classification?: DataClassification): Promise<any> {
    const dataClass = classification || this.classifyData(data);
    
    logger.info('Handling data securely', { 
      classification: dataClass.level,
      handling: dataClass.handling 
    });

    let result = data;

    if (dataClass.handling?.hashing) {
      result = await this.hashData(result);
    }

    if (dataClass.handling?.masking) {
      result = this.maskData(result);
    }

    if (dataClass.handling?.tokenization) {
      result = this.tokenizeData(result);
    }

    if (dataClass.handling?.encryption) {
      result = await this.encryptData(result);
    }

    return result;
  }

  /**
   * Encrypt sensitive data
   */
  public async encryptData(data: any): Promise<{ encrypted: string; iv: string; tag: string }> {
    try {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(
        SecureDataHandler.ENCRYPTION_ALGORITHM,
        this.encryptionKey,
        iv
      );

      let encrypted = cipher.update(dataStr, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const tag = (cipher as any).getAuthTag();

      return {
        encrypted,
        iv: iv.toString('base64'),
        tag: tag.toString('base64')
      };
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  public async decryptData(encryptedData: string, iv: string, tag: string): Promise<any> {
    try {
      const decipher = crypto.createDecipheriv(
        SecureDataHandler.ENCRYPTION_ALGORITHM,
        this.encryptionKey,
        Buffer.from(iv, 'base64')
      );

      (decipher as any).setAuthTag(Buffer.from(tag, 'base64'));

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash data (one-way)
   */
  public async hashData(data: any): Promise<string> {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const salt = crypto.randomBytes(SecureDataHandler.SALT_LENGTH);
    
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(dataStr, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) {
          reject(err);
        } else {
          resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
        }
      });
    });
  }

  /**
   * Verify hashed data
   */
  public async verifyHash(data: any, hash: string): Promise<boolean> {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const [salt, key] = hash.split(':');
    
    return new Promise((resolve) => {
      crypto.pbkdf2(dataStr, Buffer.from(salt, 'hex'), 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) {
          resolve(false);
        } else {
          resolve(key === derivedKey.toString('hex'));
        }
      });
    });
  }

  /**
   * Mask sensitive data
   */
  public maskData(data: any): any {
    if (typeof data === 'string') {
      return this.maskString(data);
    }
    
    if (typeof data === 'object' && data !== null) {
      const masked = Array.isArray(data) ? [] : {};
      
      for (const key in data) {
        if (this.isSensitiveField(key)) {
          masked[key] = this.maskValue(data[key]);
        } else if (typeof data[key] === 'object') {
          masked[key] = this.maskData(data[key]);
        } else {
          masked[key] = data[key];
        }
      }
      
      return masked;
    }
    
    return data;
  }

  /**
   * Tokenize sensitive data
   */
  public tokenizeData(data: any): string {
    const token = 'tok_' + crypto.randomBytes(16).toString('hex');
    this.tokenStore.set(token, data);
    
    // Set expiration
    setTimeout(() => {
      this.tokenStore.delete(token);
    }, 3600000); // 1 hour
    
    return token;
  }

  /**
   * Detokenize data
   */
  public detokenizeData(token: string): any {
    const data = this.tokenStore.get(token);
    if (!data) {
      throw new Error('Invalid or expired token');
    }
    return data;
  }

  /**
   * Sanitize data for output
   */
  public sanitizeForOutput(data: any, context: 'html' | 'json' | 'sql' | 'shell'): any {
    if (typeof data !== 'string') {
      return data;
    }

    switch (context) {
      case 'html':
        return data
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      
      case 'json':
        return data
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
      
      case 'sql':
        return data.replace(/['";\\]/g, '');
      
      case 'shell':
        return data.replace(/[`$(){}[\]|&;<>'"\\]/g, '');
      
      default:
        return data;
    }
  }

  /**
   * Create secure data wrapper
   */
  public createSecureWrapper<T>(data: T, classification: DataClassification): SecureDataWrapper<T> {
    return new SecureDataWrapper(data, classification, this);
  }

  /**
   * Check for sensitive patterns
   */
  private containsSensitivePatterns(data: string, patterns: string[]): boolean {
    return patterns.some(pattern => data.includes(pattern));
  }

  /**
   * Check if field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'ssn', 'creditcard',
      'credit_card', 'cvv', 'pin', 'private', 'auth'
    ];
    
    const field = fieldName.toLowerCase();
    return sensitiveFields.some(sensitive => field.includes(sensitive));
  }

  /**
   * Mask string value
   */
  private maskString(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    
    // Email masking
    if (value.includes('@')) {
      const [local, domain] = value.split('@');
      return local.substring(0, 2) + '***@' + domain;
    }
    
    // Credit card masking
    if (/^\d{13,19}$/.test(value)) {
      return '*'.repeat(value.length - 4) + value.slice(-4);
    }
    
    // Default masking
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
  }

  /**
   * Mask any value type
   */
  private maskValue(value: any): any {
    if (typeof value === 'string') {
      return this.maskString(value);
    }
    if (typeof value === 'number') {
      return '***';
    }
    if (typeof value === 'object') {
      return this.maskData(value);
    }
    return '***';
  }
}

/**
 * Secure Data Wrapper
 * Provides controlled access to sensitive data
 */
export class SecureDataWrapper<T> {
  private accessLog: Array<{ timestamp: Date; operation: string; context?: any }> = [];

  constructor(
    private data: T,
    private classification: DataClassification,
    private handler: SecureDataHandler
  ) {}

  /**
   * Get data with audit logging
   */
  public async getData(context?: any): Promise<T> {
    this.logAccess('read', context);
    
    if (this.classification.level === 'restricted') {
      logger.warn('Accessing restricted data', { context });
    }
    
    return this.data;
  }

  /**
   * Get masked data
   */
  public getMaskedData(): any {
    this.logAccess('read-masked');
    return this.handler.maskData(this.data);
  }

  /**
   * Get tokenized reference
   */
  public getToken(): string {
    this.logAccess('tokenize');
    return this.handler.tokenizeData(this.data);
  }

  /**
   * Update data with audit
   */
  public async updateData(newData: T, context?: any): Promise<void> {
    this.logAccess('update', context);
    
    if (this.classification.level === 'restricted') {
      logger.warn('Updating restricted data', { context });
    }
    
    this.data = newData;
  }

  /**
   * Get classification
   */
  public getClassification(): DataClassification {
    return this.classification;
  }

  /**
   * Get access log
   */
  public getAccessLog(): Array<{ timestamp: Date; operation: string; context?: any }> {
    return [...this.accessLog];
  }

  /**
   * Log data access
   */
  private logAccess(operation: string, context?: any): void {
    this.accessLog.push({
      timestamp: new Date(),
      operation,
      context
    });
  }
}

// Export singleton instance with default key
export const secureDataHandler = new SecureDataHandler();