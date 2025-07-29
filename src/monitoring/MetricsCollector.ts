import { EventEmitter } from 'events';
import { IService, ServiceStatus, HealthCheckResult } from '../types/IService';

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
  unit?: string;
  description?: string;
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  labels?: string[];
  buckets?: number[]; // For histograms
}

export interface MetricsSnapshot {
  timestamp: Date;
  metrics: Metric[];
  systemMetrics: SystemMetrics;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  process: {
    uptime: number;
    pid: number;
    version: string;
  };
}

export interface MetricsCollectorConfig {
  collectInterval: number;
  enableSystemMetrics: boolean;
  enableCustomMetrics: boolean;
  retentionPeriod: number;
  aggregationInterval: number;
}

class MetricStore {
  private metrics: Map<string, Metric[]> = new Map();
  private definitions: Map<string, MetricDefinition> = new Map();

  registerMetric(definition: MetricDefinition): void {
    const key = this.getMetricKey(definition.name, definition.labels || []);
    this.definitions.set(key, definition);
  }

  record(metric: Metric): void {
    const key = this.getMetricKey(metric.name, Object.keys(metric.labels || {}));
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(metric);
  }

  getMetrics(name?: string, labels?: Record<string, string>): Metric[] {
    if (!name) {
      return Array.from(this.metrics.values()).flat();
    }

    const key = this.getMetricKey(name, Object.keys(labels || {}));
    return this.metrics.get(key) || [];
  }

  clear(olderThan?: Date): void {
    if (!olderThan) {
      this.metrics.clear();
      return;
    }

    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > olderThan);
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    }
  }

  private getMetricKey(name: string, labelKeys: string[]): string {
    return `${name}:${labelKeys.sort().join(',')}`
  }
}

export class MetricsCollector extends EventEmitter implements IService {
  readonly id = 'metrics-collector';
  readonly name = 'Metrics Collector';
  readonly version = '1.0.0';

  private config: MetricsCollectorConfig;
  private store = new MetricStore();
  private running = false;
  private collectTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private startTime = Date.now();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    super();
    this.config = {
      collectInterval: 10000, // 10 seconds
      enableSystemMetrics: true,
      enableCustomMetrics: true,
      retentionPeriod: 3600000, // 1 hour
      aggregationInterval: 60000, // 1 minute
      ...config
    };

    this.registerDefaultMetrics();
  }

  private registerDefaultMetrics(): void {
    // System metrics
    this.store.registerMetric({
      name: 'system.cpu.usage',
      type: MetricType.GAUGE,
      description: 'CPU usage percentage',
      unit: 'percent'
    });

    this.store.registerMetric({
      name: 'system.memory.used',
      type: MetricType.GAUGE,
      description: 'Memory usage in bytes',
      unit: 'bytes'
    });

    // Application metrics
    this.store.registerMetric({
      name: 'app.requests.total',
      type: MetricType.COUNTER,
      description: 'Total number of requests',
      labels: ['method', 'status']
    });

    this.store.registerMetric({
      name: 'app.response.time',
      type: MetricType.HISTOGRAM,
      description: 'Response time in milliseconds',
      unit: 'ms',
      buckets: [10, 50, 100, 500, 1000, 5000]
    });
  }

  async initialize(): Promise<void> {
    // Initialize metric collection
    this.emit('initialized');
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.startTime = Date.now();

    // Start periodic collection
    this.collectTimer = setInterval(
      () => this.collect(),
      this.config.collectInterval
    );

    // Start cleanup timer
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      this.config.aggregationInterval
    );

    // Collect initial metrics
    await this.collect();
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    if (this.collectTimer) {
      clearInterval(this.collectTimer);
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.emit('stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): ServiceStatus {
    return {
      state: this.running ? 'running' : 'stopped',
      uptime: this.running ? Date.now() - this.startTime : 0,
      metadata: {
        metricsCount: this.store.getMetrics().length,
        countersCount: this.counters.size,
        gaugesCount: this.gauges.size
      }
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const metricsCount = this.store.getMetrics().length;
    return {
      healthy: this.running && metricsCount > 0,
      message: this.running ? 'Collecting metrics' : 'Collector stopped',
      details: {
        metricsCount,
        uptime: Date.now() - this.startTime
      },
      timestamp: new Date()
    };
  }

  // Metric recording methods
  incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>
  ): void {
    const key = this.getCounterKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);

    this.store.record({
      name,
      type: MetricType.COUNTER,
      value: this.counters.get(key)!,
      labels,
      timestamp: new Date()
    });

    this.emit('metric', { name, type: 'counter', value, labels });
  }

  setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const key = this.getCounterKey(name, labels);
    this.gauges.set(key, value);

    this.store.record({
      name,
      type: MetricType.GAUGE,
      value,
      labels,
      timestamp: new Date()
    });

    this.emit('metric', { name, type: 'gauge', value, labels });
  }

  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const key = this.getCounterKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);

    this.store.record({
      name,
      type: MetricType.HISTOGRAM,
      value,
      labels,
      timestamp: new Date()
    });

    this.emit('metric', { name, type: 'histogram', value, labels });
  }

  // Timer utility
  startTimer(name: string, labels?: Record<string, string>): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordHistogram(name, duration, labels);
    };
  }

  // Collection methods
  private async collect(): Promise<void> {
    if (this.config.enableSystemMetrics) {
      await this.collectSystemMetrics();
    }

    const snapshot: MetricsSnapshot = {
      timestamp: new Date(),
      metrics: this.store.getMetrics(),
      systemMetrics: await this.getSystemMetrics()
    };

    this.emit('snapshot', snapshot);
  }

  private async collectSystemMetrics(): Promise<void> {
    const metrics = await this.getSystemMetrics();

    this.setGauge('system.cpu.usage', metrics.cpu.usage);
    this.setGauge('system.memory.used', metrics.memory.used);
    this.setGauge('system.memory.heap.used', metrics.memory.heapUsed);
    this.setGauge('process.uptime', metrics.process.uptime);
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      cpu: {
        usage: cpuUsage.user / 1000000, // Convert to seconds
        cores: require('os').cpus().length
      },
      memory: {
        total: require('os').totalmem(),
        free: require('os').freemem(),
        used: require('os').totalmem() - require('os').freemem(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version
      }
    };
  }

  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod);
    this.store.clear(cutoff);
  }

  private getCounterKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  // Query methods
  getMetric(name: string, labels?: Record<string, string>): Metric[] {
    return this.store.getMetrics(name, labels);
  }

  getSnapshot(): MetricsSnapshot {
    return {
      timestamp: new Date(),
      metrics: this.store.getMetrics(),
      systemMetrics: this.getSystemMetrics()
    };
  }

  getAggregatedMetrics(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    period: number
  ): number | null {
    const cutoff = new Date(Date.now() - period);
    const metrics = this.store.getMetrics(name)
      .filter(m => m.timestamp > cutoff)
      .map(m => m.value);

    if (metrics.length === 0) return null;

    switch (aggregation) {
      case 'sum':
        return metrics.reduce((a, b) => a + b, 0);
      case 'avg':
        return metrics.reduce((a, b) => a + b, 0) / metrics.length;
      case 'min':
        return Math.min(...metrics);
      case 'max':
        return Math.max(...metrics);
      case 'count':
        return metrics.length;
    }
  }

  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.getCounterKey(name, labels);
    const values = this.histograms.get(key);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      sum,
      avg: sum / count,
      min: sorted[0],
      max: sorted[count - 1],
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    const metrics = this.store.getMetrics();

    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    }

    // Prometheus format
    const lines: string[] = [];
    const grouped = new Map<string, Metric[]>();

    for (const metric of metrics) {
      if (!grouped.has(metric.name)) {
        grouped.set(metric.name, []);
      }
      grouped.get(metric.name)!.push(metric);
    }

    for (const [name, metrics] of grouped) {
      const latest = metrics[metrics.length - 1];
      if (latest.description) {
        lines.push(`# HELP ${name} ${latest.description}`);
      }
      if (latest.type) {
        lines.push(`# TYPE ${name} ${latest.type}`);
      }

      for (const metric of metrics) {
        const labelStr = metric.labels
          ? `{${Object.entries(metric.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')}}`
          : '';
        lines.push(`${name}${labelStr} ${metric.value}`);
      }
    }

    return lines.join('\n');
  }

  async dispose(): Promise<void> {
    await this.stop();
    this.store.clear();
    this.removeAllListeners();
  }
}