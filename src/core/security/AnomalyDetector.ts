/**
 * Anomaly Detector
 * Detects suspicious patterns and behaviors in system operations
 */

import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface AnomalyPattern {
  id: string;
  name: string;
  description: string;
  detector: (data: any) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: AnomalyAction[];
}

export interface AnomalyAction {
  type: 'log' | 'alert' | 'block' | 'rateLimit' | 'notify';
  metadata?: any;
}

export interface AnomalyEvent {
  id: string;
  timestamp: Date;
  pattern: AnomalyPattern;
  data: any;
  context: any;
  actions: AnomalyAction[];
}

export interface AnomalyStatistics {
  totalDetected: number;
  bySeverity: Record<string, number>;
  byPattern: Record<string, number>;
  recentEvents: AnomalyEvent[];
}

export class AnomalyDetector extends EventEmitter {
  private patterns: Map<string, AnomalyPattern> = new Map();
  private statistics: AnomalyStatistics = {
    totalDetected: 0,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    byPattern: {},
    recentEvents: []
  };
  private maxRecentEvents = 100;

  constructor() {
    super();
    this.initializeDefaultPatterns();
  }

  /**
   * Initialize default anomaly patterns
   */
  private initializeDefaultPatterns(): void {
    // SQL Injection Pattern
    this.addPattern({
      id: 'sql-injection',
      name: 'SQL Injection Attempt',
      description: 'Detects potential SQL injection patterns',
      detector: (data: any) => {
        const sqlPatterns = [
          /(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|where|table|database)\b)/i,
          /(\'|\"|;|--|\*|\/\*|\*\/|xp_|sp_|exec|execute)/i,
          /(\b(or|and)\b\s*\d+\s*=\s*\d+)/i
        ];
        const text = JSON.stringify(data).toLowerCase();
        return sqlPatterns.some(pattern => pattern.test(text));
      },
      severity: 'critical',
      actions: [
        { type: 'log' },
        { type: 'alert' },
        { type: 'block' }
      ]
    });

    // XSS Pattern
    this.addPattern({
      id: 'xss-attempt',
      name: 'Cross-Site Scripting Attempt',
      description: 'Detects potential XSS patterns',
      detector: (data: any) => {
        const xssPatterns = [
          /<script[^>]*>.*?<\/script>/gi,
          /<iframe[^>]*>.*?<\/iframe>/gi,
          /javascript:/gi,
          /on\w+\s*=\s*["'][^"']*["']/gi
        ];
        const text = JSON.stringify(data);
        return xssPatterns.some(pattern => pattern.test(text));
      },
      severity: 'high',
      actions: [
        { type: 'log' },
        { type: 'alert' },
        { type: 'block' }
      ]
    });

    // Rapid Request Pattern
    this.addPattern({
      id: 'rapid-requests',
      name: 'Rapid Request Pattern',
      description: 'Detects unusually rapid request patterns',
      detector: (data: any) => {
        if (!data.requestCount || !data.timeWindow) return false;
        const requestsPerSecond = data.requestCount / (data.timeWindow / 1000);
        return requestsPerSecond > 10; // More than 10 requests per second
      },
      severity: 'medium',
      actions: [
        { type: 'log' },
        { type: 'rateLimit' }
      ]
    });

    // Large Payload Pattern
    this.addPattern({
      id: 'large-payload',
      name: 'Unusually Large Payload',
      description: 'Detects payloads exceeding normal size',
      detector: (data: any) => {
        const size = JSON.stringify(data).length;
        return size > 1024 * 1024; // 1MB
      },
      severity: 'low',
      actions: [
        { type: 'log' }
      ]
    });

    // Path Traversal Pattern
    this.addPattern({
      id: 'path-traversal',
      name: 'Path Traversal Attempt',
      description: 'Detects potential path traversal patterns',
      detector: (data: any) => {
        const patterns = [
          /\.\.(\/|\\)/g,
          /\.\.%2F/gi,
          /\.\.%5C/gi
        ];
        const text = JSON.stringify(data);
        return patterns.some(pattern => pattern.test(text));
      },
      severity: 'high',
      actions: [
        { type: 'log' },
        { type: 'alert' },
        { type: 'block' }
      ]
    });

    // Command Injection Pattern
    this.addPattern({
      id: 'command-injection',
      name: 'Command Injection Attempt',
      description: 'Detects potential command injection',
      detector: (data: any) => {
        const patterns = [
          /[;&|`\$\(\)]/g,
          /\b(cat|ls|rm|mv|cp|wget|curl|nc|bash|sh)\b/g
        ];
        const text = JSON.stringify(data);
        return patterns.some(pattern => pattern.test(text));
      },
      severity: 'critical',
      actions: [
        { type: 'log' },
        { type: 'alert' },
        { type: 'block' }
      ]
    });

    // Failed Authentication Pattern
    this.addPattern({
      id: 'failed-auth',
      name: 'Multiple Failed Authentications',
      description: 'Detects multiple failed authentication attempts',
      detector: (data: any) => {
        return data.failedAttempts && data.failedAttempts >= 5;
      },
      severity: 'high',
      actions: [
        { type: 'log' },
        { type: 'alert' },
        { type: 'rateLimit' },
        { type: 'notify' }
      ]
    });

    // Unusual Time Pattern
    this.addPattern({
      id: 'unusual-time',
      name: 'Unusual Time Activity',
      description: 'Detects activity during unusual hours',
      detector: (data: any) => {
        const hour = new Date().getHours();
        return hour >= 2 && hour <= 5; // 2 AM - 5 AM
      },
      severity: 'low',
      actions: [
        { type: 'log' }
      ]
    });
  }

  /**
   * Add a new anomaly pattern
   */
  public addPattern(pattern: AnomalyPattern): void {
    this.patterns.set(pattern.id, pattern);
    logger.info(`Anomaly pattern added: ${pattern.name}`, { patternId: pattern.id });
  }

  /**
   * Remove an anomaly pattern
   */
  public removePattern(patternId: string): void {
    this.patterns.delete(patternId);
    logger.info(`Anomaly pattern removed: ${patternId}`);
  }

  /**
   * Check data against all patterns
   */
  public async check(data: any, context: any = {}): Promise<AnomalyEvent[]> {
    const detectedAnomalies: AnomalyEvent[] = [];

    for (const [id, pattern] of this.patterns) {
      try {
        if (pattern.detector(data)) {
          const event: AnomalyEvent = {
            id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            pattern,
            data,
            context,
            actions: pattern.actions
          };

          detectedAnomalies.push(event);
          this.recordAnomaly(event);
          await this.executeActions(event);
        }
      } catch (error) {
        logger.error(`Error checking pattern ${id}:`, error);
      }
    }

    return detectedAnomalies;
  }

  /**
   * Record anomaly in statistics
   */
  private recordAnomaly(event: AnomalyEvent): void {
    this.statistics.totalDetected++;
    this.statistics.bySeverity[event.pattern.severity]++;
    
    if (!this.statistics.byPattern[event.pattern.id]) {
      this.statistics.byPattern[event.pattern.id] = 0;
    }
    this.statistics.byPattern[event.pattern.id]++;

    // Add to recent events
    this.statistics.recentEvents.unshift(event);
    if (this.statistics.recentEvents.length > this.maxRecentEvents) {
      this.statistics.recentEvents.pop();
    }

    // Emit event
    this.emit('anomaly', event);
  }

  /**
   * Execute actions for detected anomaly
   */
  private async executeActions(event: AnomalyEvent): Promise<void> {
    for (const action of event.actions) {
      try {
        switch (action.type) {
          case 'log':
            logger.warn(`Anomaly detected: ${event.pattern.name}`, {
              patternId: event.pattern.id,
              severity: event.pattern.severity,
              data: event.data
            });
            break;

          case 'alert':
            this.emit('alert', event);
            logger.error(`SECURITY ALERT: ${event.pattern.name}`, {
              patternId: event.pattern.id,
              severity: event.pattern.severity,
              context: event.context
            });
            break;

          case 'block':
            this.emit('block', event);
            break;

          case 'rateLimit':
            this.emit('rateLimit', event);
            break;

          case 'notify':
            this.emit('notify', event);
            break;
        }
      } catch (error) {
        logger.error(`Error executing action ${action.type}:`, error);
      }
    }
  }

  /**
   * Get anomaly statistics
   */
  public getStatistics(): AnomalyStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  public resetStatistics(): void {
    this.statistics = {
      totalDetected: 0,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byPattern: {},
      recentEvents: []
    };
  }

  /**
   * Get all patterns
   */
  public getPatterns(): AnomalyPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get pattern by ID
   */
  public getPattern(patternId: string): AnomalyPattern | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * Enable/disable pattern
   */
  public togglePattern(patternId: string, enabled: boolean): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      if (enabled) {
        this.patterns.set(patternId, pattern);
      } else {
        this.patterns.delete(patternId);
      }
    }
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetector();