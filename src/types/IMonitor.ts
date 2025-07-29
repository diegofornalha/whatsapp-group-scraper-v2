/**
 * Core monitoring interfaces for system observability
 */

/**
 * Base monitor interface
 */
export interface IMonitor {
  name: string;
  isActive: boolean;
  
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): MonitorStatus;
}

/**
 * Performance monitor interface
 */
export interface IPerformanceMonitor extends IMonitor {
  startTimer(operation: string): Timer;
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  getMetrics(timeRange?: TimeRange): Promise<Metric[]>;
  getAverageResponseTime(operation: string, timeRange?: TimeRange): Promise<number>;
  getPercentile(operation: string, percentile: number, timeRange?: TimeRange): Promise<number>;
}

/**
 * Error monitor interface
 */
export interface IErrorMonitor extends IMonitor {
  captureError(error: Error, context?: ErrorContext): void;
  captureException(exception: any, context?: ErrorContext): void;
  getErrors(filter?: ErrorFilter): Promise<MonitoredError[]>;
  getErrorRate(timeRange?: TimeRange): Promise<number>;
  clearErrors(): Promise<void>;
}

/**
 * Activity monitor interface
 */
export interface IActivityMonitor extends IMonitor {
  trackActivity(activity: Activity): void;
  getActivities(filter?: ActivityFilter): Promise<Activity[]>;
  getActivityStats(timeRange?: TimeRange): Promise<ActivityStats>;
  getUserActivity(userId: string, timeRange?: TimeRange): Promise<UserActivityStats>;
}

/**
 * Resource monitor interface
 */
export interface IResourceMonitor extends IMonitor {
  getCpuUsage(): Promise<number>;
  getMemoryUsage(): Promise<MemoryUsage>;
  getDiskUsage(): Promise<DiskUsage>;
  getNetworkStats(): Promise<NetworkStats>;
  getResourceHistory(resource: ResourceType, timeRange?: TimeRange): Promise<ResourceHistory[]>;
}

/**
 * Health monitor interface
 */
export interface IHealthMonitor extends IMonitor {
  addHealthCheck(name: string, check: HealthCheck): void;
  removeHealthCheck(name: string): void;
  runHealthChecks(): Promise<HealthCheckResult[]>;
  getOverallHealth(): Promise<HealthStatus>;
  getHealthHistory(timeRange?: TimeRange): Promise<HealthSnapshot[]>;
}

/**
 * Monitor types and interfaces
 */
export interface MonitorStatus {
  isActive: boolean;
  uptime: number;
  lastCheck: Date;
  errors: number;
}

export interface Timer {
  stop(): number;
  lap(): number;
  elapsed(): number;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface ErrorContext {
  userId?: string;
  groupId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface ErrorFilter {
  severity?: ErrorSeverity;
  type?: string;
  userId?: string;
  timeRange?: TimeRange;
}

export interface MonitoredError {
  id: string;
  message: string;
  stack?: string;
  type: string;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: ErrorContext;
  count: number;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  groupId?: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum ActivityType {
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  GROUP_JOINED = 'group_joined',
  GROUP_LEFT = 'group_left',
  MEDIA_UPLOADED = 'media_uploaded',
  MEDIA_DOWNLOADED = 'media_downloaded',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout'
}

export interface ActivityFilter {
  type?: ActivityType;
  userId?: string;
  groupId?: string;
  timeRange?: TimeRange;
}

export interface ActivityStats {
  totalActivities: number;
  activitiesByType: Record<ActivityType, number>;
  mostActiveUsers: Array<{ userId: string; count: number }>;
  mostActiveGroups: Array<{ groupId: string; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

export interface UserActivityStats {
  userId: string;
  totalActivities: number;
  activitiesByType: Record<ActivityType, number>;
  lastActivity: Date;
  averageActivitiesPerDay: number;
}

export interface MemoryUsage {
  total: number;
  used: number;
  free: number;
  percentage: number;
}

export interface DiskUsage {
  total: number;
  used: number;
  free: number;
  percentage: number;
}

export interface NetworkStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  errors: number;
}

export enum ResourceType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk',
  NETWORK = 'network'
}

export interface ResourceHistory {
  timestamp: Date;
  value: number;
  type: ResourceType;
}

export type HealthCheck = () => Promise<boolean>;

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy';
  message?: string;
  duration: number;
  timestamp: Date;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

export interface HealthSnapshot {
  timestamp: Date;
  status: HealthStatus;
  checks: HealthCheckResult[];
}

/**
 * Alerting interface
 */
export interface IAlertManager {
  addAlert(alert: Alert): void;
  removeAlert(alertId: string): void;
  getActiveAlerts(): Alert[];
  checkAlerts(): Promise<AlertResult[]>;
  acknowledgeAlert(alertId: string): void;
}

export interface Alert {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  actions: AlertAction[];
  cooldown?: number;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';
  threshold: number;
  duration?: number;
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'log';
  config: Record<string, any>;
}

export interface AlertResult {
  alert: Alert;
  triggered: boolean;
  value?: number;
  message?: string;
  timestamp: Date;
}

/**
 * Monitor factory interface
 */
export interface IMonitorFactory {
  createPerformanceMonitor(): IPerformanceMonitor;
  createErrorMonitor(): IErrorMonitor;
  createActivityMonitor(): IActivityMonitor;
  createResourceMonitor(): IResourceMonitor;
  createHealthMonitor(): IHealthMonitor;
  createAlertManager(): IAlertManager;
}