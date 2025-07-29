import { EventEmitter } from 'events';
import { MetricsCollector } from './MetricsCollector';
import { Logger } from './Logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceBottleneck {
  type: 'cpu' | 'memory' | 'io' | 'network' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  duration: number;
  description: string;
  recommendations: string[];
  timestamp: Date;
}

export interface PerformanceThreshold {
  metric: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sustained?: number; // Duration in ms before triggering
}

export interface PerformanceProfile {
  name: string;
  startTime: number;
  endTime?: number;
  metrics: Map<string, number[]>;
  markers: PerformanceMarker[];
  bottlenecks: PerformanceBottleneck[];
}

export interface PerformanceMarker {
  name: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMonitorConfig {
  enableProfiling: boolean;
  enableBottleneckDetection: boolean;
  sampleInterval: number;
  bottleneckCheckInterval: number;
  thresholds: PerformanceThreshold[];
  maxProfileDuration: number;
}

export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitorConfig;
  private metricsCollector: MetricsCollector;
  private logger: Logger;
  private profiles = new Map<string, PerformanceProfile>();
  private activeProfile?: string;
  private bottleneckCheckTimer?: NodeJS.Timeout;
  private thresholdViolations = new Map<string, number>();
  private performanceObserver?: any; // PerformanceObserver if available

  constructor(
    metricsCollector: MetricsCollector,
    logger: Logger,
    config: Partial<PerformanceMonitorConfig> = {}
  ) {
    super();
    this.metricsCollector = metricsCollector;
    this.logger = logger.createContext('PerformanceMonitor');
    
    this.config = {
      enableProfiling: true,
      enableBottleneckDetection: true,
      sampleInterval: 100, // 100ms
      bottleneckCheckInterval: 5000, // 5 seconds
      maxProfileDuration: 300000, // 5 minutes
      thresholds: this.getDefaultThresholds(),
      ...config
    };

    this.initialize();
  }

  private getDefaultThresholds(): PerformanceThreshold[] {
    return [
      {
        metric: 'cpu.usage',
        threshold: 80,
        operator: '>',
        severity: 'high',
        sustained: 5000
      },
      {
        metric: 'memory.heapUsed',
        threshold: 0.9, // 90% of heap
        operator: '>',
        severity: 'critical',
        sustained: 3000
      },
      {
        metric: 'eventLoop.delay',
        threshold: 100,
        operator: '>',
        severity: 'medium',
        sustained: 2000
      }
    ];
  }

  private initialize(): void {
    if (this.config.enableBottleneckDetection) {
      this.startBottleneckDetection();
    }

    // Set up performance observer if available
    if (typeof global !== 'undefined' && 'PerformanceObserver' in global) {
      this.setupPerformanceObserver();
    }
  }

  private startBottleneckDetection(): void {
    this.bottleneckCheckTimer = setInterval(
      () => this.checkBottlenecks(),
      this.config.bottleneckCheckInterval
    );
  }

  private setupPerformanceObserver(): void {
    try {
      const { PerformanceObserver, performance } = require('perf_hooks');
      
      this.performanceObserver = new PerformanceObserver((items: any) => {
        for (const entry of items.getEntries()) {
          this.recordPerformanceEntry(entry);
        }
      });

      this.performanceObserver.observe({ 
        entryTypes: ['measure', 'mark', 'function', 'resource'] 
      });
    } catch (error) {
      this.logger.warn('Performance Observer not available', { error });
    }
  }

  private recordPerformanceEntry(entry: any): void {
    this.metricsCollector.recordHistogram(
      `performance.${entry.entryType}`,
      entry.duration || 0,
      { name: entry.name }
    );
  }

  // Profiling methods
  startProfile(name: string): void {
    if (this.profiles.has(name)) {
      this.logger.warn(`Profile ${name} already exists`);
      return;
    }

    const profile: PerformanceProfile = {
      name,
      startTime: Date.now(),
      metrics: new Map(),
      markers: [],
      bottlenecks: []
    };

    this.profiles.set(name, profile);
    this.activeProfile = name;
    
    this.logger.info(`Started performance profile: ${name}`);
    this.emit('profileStarted', name);

    // Auto-stop profile after max duration
    setTimeout(() => {
      if (this.profiles.has(name) && !this.profiles.get(name)!.endTime) {
        this.stopProfile(name);
      }
    }, this.config.maxProfileDuration);
  }

  stopProfile(name: string): PerformanceProfile | null {
    const profile = this.profiles.get(name);
    if (!profile) {
      this.logger.warn(`Profile ${name} not found`);
      return null;
    }

    if (profile.endTime) {
      this.logger.warn(`Profile ${name} already stopped`);
      return profile;
    }

    profile.endTime = Date.now();
    
    if (this.activeProfile === name) {
      this.activeProfile = undefined;
    }

    this.logger.info(`Stopped performance profile: ${name}`, {
      duration: profile.endTime - profile.startTime
    });

    this.emit('profileStopped', name, profile);
    return profile;
  }

  addMarker(name: string, metadata?: Record<string, any>): void {
    if (!this.activeProfile) return;

    const profile = this.profiles.get(this.activeProfile);
    if (!profile) return;

    profile.markers.push({
      name,
      timestamp: Date.now(),
      metadata
    });

    this.logger.debug(`Added marker: ${name}`, { profile: this.activeProfile });
  }

  recordMetric(
    metricName: string,
    value: number,
    unit: string = 'ms',
    tags?: Record<string, string>
  ): void {
    // Record to metrics collector
    this.metricsCollector.recordHistogram(
      `performance.${metricName}`,
      value,
      tags
    );

    // Record to active profile if any
    if (this.activeProfile) {
      const profile = this.profiles.get(this.activeProfile);
      if (profile) {
        if (!profile.metrics.has(metricName)) {
          profile.metrics.set(metricName, []);
        }
        profile.metrics.get(metricName)!.push(value);
      }
    }

    this.emit('metricRecorded', {
      name: metricName,
      value,
      unit,
      timestamp: new Date(),
      tags
    } as PerformanceMetric);
  }

  // Measurement utilities
  measure<T>(name: string, fn: () => T): T {
    const timer = this.metricsCollector.startTimer(`performance.${name}`);
    try {
      const result = fn();
      timer();
      return result;
    } catch (error) {
      timer();
      throw error;
    }
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const timer = this.metricsCollector.startTimer(`performance.${name}`);
    try {
      const result = await fn();
      timer();
      return result;
    } catch (error) {
      timer();
      throw error;
    }
  }

  // Bottleneck detection
  private async checkBottlenecks(): Promise<void> {
    const snapshot = await this.metricsCollector.getSnapshot();
    const bottlenecks: PerformanceBottleneck[] = [];

    // Check CPU usage
    const cpuUsage = snapshot.systemMetrics.cpu.usage;
    const cpuBottleneck = this.checkThreshold('cpu.usage', cpuUsage);
    if (cpuBottleneck) {
      bottlenecks.push({
        type: 'cpu',
        severity: cpuBottleneck.severity,
        metric: 'cpu.usage',
        currentValue: cpuUsage,
        threshold: cpuBottleneck.threshold,
        duration: cpuBottleneck.duration,
        description: `CPU usage is ${cpuUsage.toFixed(1)}%`,
        recommendations: [
          'Consider optimizing CPU-intensive operations',
          'Use worker threads for heavy computations',
          'Profile code to identify hot spots'
        ],
        timestamp: new Date()
      });
    }

    // Check memory usage
    const heapUsed = snapshot.systemMetrics.memory.heapUsed;
    const heapTotal = snapshot.systemMetrics.memory.heapTotal;
    const heapRatio = heapUsed / heapTotal;
    
    const memoryBottleneck = this.checkThreshold('memory.heapUsed', heapRatio);
    if (memoryBottleneck) {
      bottlenecks.push({
        type: 'memory',
        severity: memoryBottleneck.severity,
        metric: 'memory.heapUsed',
        currentValue: heapRatio,
        threshold: memoryBottleneck.threshold,
        duration: memoryBottleneck.duration,
        description: `Heap usage is ${(heapRatio * 100).toFixed(1)}%`,
        recommendations: [
          'Check for memory leaks',
          'Implement object pooling',
          'Reduce memory allocations',
          'Use streams for large data processing'
        ],
        timestamp: new Date()
      });
    }

    // Check event loop delay
    const eventLoopDelay = await this.measureEventLoopDelay();
    const eventLoopBottleneck = this.checkThreshold('eventLoop.delay', eventLoopDelay);
    if (eventLoopBottleneck) {
      bottlenecks.push({
        type: 'custom',
        severity: eventLoopBottleneck.severity,
        metric: 'eventLoop.delay',
        currentValue: eventLoopDelay,
        threshold: eventLoopBottleneck.threshold,
        duration: eventLoopBottleneck.duration,
        description: `Event loop delay is ${eventLoopDelay}ms`,
        recommendations: [
          'Break up long-running synchronous operations',
          'Use setImmediate() for CPU-intensive tasks',
          'Consider using worker threads'
        ],
        timestamp: new Date()
      });
    }

    if (bottlenecks.length > 0) {
      this.emit('bottlenecksDetected', bottlenecks);
      
      // Add to active profile if any
      if (this.activeProfile) {
        const profile = this.profiles.get(this.activeProfile);
        if (profile) {
          profile.bottlenecks.push(...bottlenecks);
        }
      }

      // Log critical bottlenecks
      for (const bottleneck of bottlenecks) {
        if (bottleneck.severity === 'critical') {
          this.logger.error('Critical performance bottleneck detected', undefined, {
            bottleneck
          });
        } else if (bottleneck.severity === 'high') {
          this.logger.warn('High severity performance bottleneck detected', {
            bottleneck
          });
        }
      }
    }
  }

  private checkThreshold(
    metric: string,
    value: number
  ): { severity: string; threshold: number; duration: number } | null {
    const threshold = this.config.thresholds.find(t => t.metric === metric);
    if (!threshold) return null;

    let violated = false;
    switch (threshold.operator) {
      case '>':
        violated = value > threshold.threshold;
        break;
      case '<':
        violated = value < threshold.threshold;
        break;
      case '>=':
        violated = value >= threshold.threshold;
        break;
      case '<=':
        violated = value <= threshold.threshold;
        break;
      case '==':
        violated = value === threshold.threshold;
        break;
    }

    if (violated) {
      const key = `${metric}:${threshold.threshold}`;
      const firstViolation = this.thresholdViolations.get(key) || Date.now();
      this.thresholdViolations.set(key, firstViolation);

      const duration = Date.now() - firstViolation;
      const sustained = threshold.sustained || 0;

      if (duration >= sustained) {
        return {
          severity: threshold.severity,
          threshold: threshold.threshold,
          duration
        };
      }
    } else {
      const key = `${metric}:${threshold.threshold}`;
      this.thresholdViolations.delete(key);
    }

    return null;
  }

  private async measureEventLoopDelay(): Promise<number> {
    const start = Date.now();
    return new Promise(resolve => {
      setImmediate(() => {
        resolve(Date.now() - start);
      });
    });
  }

  // Analysis methods
  getProfileAnalysis(profileName: string): any {
    const profile = this.profiles.get(profileName);
    if (!profile || !profile.endTime) return null;

    const duration = profile.endTime - profile.startTime;
    const analysis: any = {
      name: profile.name,
      duration,
      markerCount: profile.markers.length,
      bottleneckCount: profile.bottlenecks.length,
      metrics: {}
    };

    // Analyze each metric
    for (const [metric, values] of profile.metrics) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      analysis.metrics[metric] = {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        p50: sorted[Math.floor(values.length * 0.5)],
        p95: sorted[Math.floor(values.length * 0.95)],
        p99: sorted[Math.floor(values.length * 0.99)]
      };
    }

    // Group bottlenecks by type
    analysis.bottlenecksByType = profile.bottlenecks.reduce((acc, b) => {
      if (!acc[b.type]) acc[b.type] = [];
      acc[b.type].push(b);
      return acc;
    }, {} as Record<string, PerformanceBottleneck[]>);

    return analysis;
  }

  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const snapshot = this.metricsCollector.getSnapshot();

    // CPU recommendations
    if (snapshot.systemMetrics.cpu.usage > 70) {
      recommendations.push('Consider implementing CPU throttling or load balancing');
    }

    // Memory recommendations
    const heapRatio = snapshot.systemMetrics.memory.heapUsed / 
                     snapshot.systemMetrics.memory.heapTotal;
    if (heapRatio > 0.7) {
      recommendations.push('Monitor memory usage closely, consider increasing heap size');
    }

    return recommendations;
  }

  // Export methods
  exportProfile(profileName: string, format: 'json' | 'csv' = 'json'): string {
    const profile = this.profiles.get(profileName);
    if (!profile) return '';

    if (format === 'json') {
      return JSON.stringify({
        ...profile,
        metrics: Object.fromEntries(profile.metrics)
      }, null, 2);
    }

    // CSV format
    const lines: string[] = ['timestamp,type,name,value'];
    
    // Add markers
    for (const marker of profile.markers) {
      lines.push(`${marker.timestamp},marker,${marker.name},0`);
    }

    // Add metrics
    for (const [metric, values] of profile.metrics) {
      for (const value of values) {
        lines.push(`${Date.now()},metric,${metric},${value}`);
      }
    }

    return lines.join('\n');
  }

  dispose(): void {
    if (this.bottleneckCheckTimer) {
      clearInterval(this.bottleneckCheckTimer);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    this.profiles.clear();
    this.thresholdViolations.clear();
    this.removeAllListeners();
  }
}