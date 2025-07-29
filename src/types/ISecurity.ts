/**
 * Core security interfaces for system protection
 */

/**
 * Base security interface
 */
export interface ISecurity {
  name: string;
  isEnabled: boolean;
  
  initialize(): Promise<void>;
  validate(): Promise<boolean>;
}

/**
 * Authentication interface
 */
export interface IAuthenticator extends ISecurity {
  authenticate(credentials: Credentials): Promise<AuthResult>;
  validateToken(token: string): Promise<TokenValidation>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  logout(token: string): Promise<void>;
  getPermissions(userId: string): Promise<Permission[]>;
}

/**
 * Authorization interface
 */
export interface IAuthorizer extends ISecurity {
  authorize(userId: string, resource: string, action: string): Promise<boolean>;
  grantPermission(userId: string, permission: Permission): Promise<void>;
  revokePermission(userId: string, permission: Permission): Promise<void>;
  createRole(role: Role): Promise<void>;
  assignRole(userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
}

/**
 * Rate limiter interface
 */
export interface IRateLimiter extends ISecurity {
  checkLimit(identifier: string, resource: string): Promise<RateLimitResult>;
  consumeToken(identifier: string, resource: string, tokens?: number): Promise<boolean>;
  getRemainingTokens(identifier: string, resource: string): Promise<number>;
  resetLimit(identifier: string, resource?: string): Promise<void>;
  setCustomLimit(identifier: string, resource: string, limit: RateLimitConfig): Promise<void>;
}

/**
 * Input validator interface
 */
export interface IValidator extends ISecurity {
  validateInput<T>(input: any, schema: ValidationSchema): ValidationResult<T>;
  sanitizeInput(input: any, rules: SanitizationRules): any;
  validateMessage(message: string): ValidationResult<string>;
  validateUrl(url: string): ValidationResult<string>;
  validateFile(file: File, rules: FileValidationRules): ValidationResult<File>;
}

/**
 * Encryption interface
 */
export interface IEncryption extends ISecurity {
  encrypt(data: string, key?: string): Promise<string>;
  decrypt(encryptedData: string, key?: string): Promise<string>;
  hash(data: string, algorithm?: HashAlgorithm): Promise<string>;
  compareHash(data: string, hash: string): Promise<boolean>;
  generateKey(length?: number): Promise<string>;
  generateKeyPair(): Promise<KeyPair>;
}

/**
 * Audit logger interface
 */
export interface IAuditLogger extends ISecurity {
  logAccess(event: AccessEvent): Promise<void>;
  logModification(event: ModificationEvent): Promise<void>;
  logSecurityEvent(event: SecurityEvent): Promise<void>;
  getAuditLogs(filter: AuditFilter): Promise<AuditLog[]>;
  exportAuditLogs(filter: AuditFilter, format: ExportFormat): Promise<string>;
}

/**
 * Security types and interfaces
 */
export interface Credentials {
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  [key: string]: any;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  tokens?: AuthTokens;
  user?: AuthUser;
  error?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenValidation {
  valid: boolean;
  userId?: string;
  permissions?: string[];
  expiresAt?: Date;
}

export interface AuthUser {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface RateLimitConfig {
  limit: number;
  window: number; // in seconds
  strategy?: 'sliding' | 'fixed';
}

export interface ValidationSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, ValidationSchema>;
  items?: ValidationSchema;
  required?: string[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  enum?: any[];
}

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface SanitizationRules {
  stripHtml?: boolean;
  stripScripts?: boolean;
  escapeSpecialChars?: boolean;
  normalizeWhitespace?: boolean;
  maxLength?: number;
  allowedTags?: string[];
}

export interface File {
  name: string;
  size: number;
  type: string;
  content: Buffer | ArrayBuffer;
}

export interface FileValidationRules {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  scanForVirus?: boolean;
}

export enum HashAlgorithm {
  SHA256 = 'sha256',
  SHA512 = 'sha512',
  BCRYPT = 'bcrypt',
  ARGON2 = 'argon2'
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface AccessEvent {
  userId: string;
  resource: string;
  action: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface ModificationEvent {
  userId: string;
  resource: string;
  action: 'create' | 'update' | 'delete';
  before?: any;
  after?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  description: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export enum SecurityEventType {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  TOKEN_EXPIRED = 'token_expired',
  PERMISSION_DENIED = 'permission_denied',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuditFilter {
  userId?: string;
  resource?: string;
  action?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: SecuritySeverity;
}

export interface AuditLog {
  id: string;
  type: 'access' | 'modification' | 'security';
  event: AccessEvent | ModificationEvent | SecurityEvent;
  timestamp: Date;
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
  EXCEL = 'excel'
}

/**
 * Security scanner interface
 */
export interface ISecurityScanner extends ISecurity {
  scanForVulnerabilities(): Promise<VulnerabilityReport>;
  scanFile(file: File): Promise<FileScanResult>;
  scanUrl(url: string): Promise<UrlScanResult>;
  scanDependencies(): Promise<DependencyScanResult>;
}

export interface VulnerabilityReport {
  timestamp: Date;
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface Vulnerability {
  id: string;
  type: string;
  severity: SecuritySeverity;
  description: string;
  affectedComponent: string;
  recommendation: string;
}

export interface FileScanResult {
  safe: boolean;
  threats?: string[];
  metadata: Record<string, any>;
}

export interface UrlScanResult {
  safe: boolean;
  category?: string;
  threats?: string[];
  sslInfo?: SslInfo;
}

export interface SslInfo {
  valid: boolean;
  issuer: string;
  expiresAt: Date;
}

export interface DependencyScanResult {
  vulnerabilities: DependencyVulnerability[];
  outdated: OutdatedDependency[];
}

export interface DependencyVulnerability {
  package: string;
  version: string;
  vulnerability: Vulnerability;
}

export interface OutdatedDependency {
  package: string;
  currentVersion: string;
  latestVersion: string;
  type: 'major' | 'minor' | 'patch';
}

/**
 * Security factory interface
 */
export interface ISecurityFactory {
  createAuthenticator(config: AuthConfig): IAuthenticator;
  createAuthorizer(): IAuthorizer;
  createRateLimiter(config: RateLimitConfig): IRateLimiter;
  createValidator(): IValidator;
  createEncryption(config?: EncryptionConfig): IEncryption;
  createAuditLogger(config: AuditConfig): IAuditLogger;
  createSecurityScanner(): ISecurityScanner;
}

export interface AuthConfig {
  strategy: 'jwt' | 'oauth' | 'apikey';
  secret?: string;
  expiresIn?: number;
  options?: Record<string, any>;
}

export interface EncryptionConfig {
  algorithm?: string;
  keyLength?: number;
}

export interface AuditConfig {
  storage: 'database' | 'file' | 'remote';
  retention?: number; // days
  options?: Record<string, any>;
}