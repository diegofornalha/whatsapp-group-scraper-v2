/**
 * Core session interfaces
 */

/**
 * Base session interface
 */
export interface ISession {
  id: string;
  type: SessionType;
  status: SessionStatus;
  startedAt: Date;
  lastActivity: Date;
  metadata?: SessionMetadata;
}

/**
 * Session types
 */
export enum SessionType {
  EXTRACTION = 'extraction',
  ANALYSIS = 'analysis',
  EXPORT = 'export',
  SYNC = 'sync',
  BACKUP = 'backup',
  MONITORING = 'monitoring'
}

/**
 * Session status
 */
export enum SessionStatus {
  PENDING = 'pending',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  userId?: string;
  source?: string;
  target?: string;
  options?: Record<string, any>;
  tags?: string[];
}

/**
 * Extraction session interface
 */
export interface IExtractionSession extends ISession {
  browser: BrowserSession;
  whatsapp: WhatsAppSession;
  extraction: ExtractionProgress;
  errors: ExtractionError[];
}

/**
 * Browser session
 */
export interface BrowserSession {
  browserType: string;
  browserVersion: string;
  headless: boolean;
  userDataDir?: string;
  isConnected: boolean;
  pageUrl?: string;
  cookies?: BrowserCookie[];
}

/**
 * Browser cookie
 */
export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
}

/**
 * WhatsApp session
 */
export interface WhatsAppSession {
  phoneNumber?: string;
  isLoggedIn: boolean;
  qrCode?: string;
  loginMethod: 'qr' | 'phone' | 'saved';
  lastSync?: Date;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

/**
 * Extraction progress
 */
export interface ExtractionProgress {
  totalGroups: number;
  processedGroups: number;
  totalMessages: number;
  processedMessages: number;
  totalMedia: number;
  processedMedia: number;
  startTime: Date;
  estimatedCompletion?: Date;
  speed: {
    messagesPerSecond: number;
    groupsPerMinute: number;
  };
}

/**
 * Extraction error
 */
export interface ExtractionError {
  timestamp: Date;
  type: string;
  message: string;
  groupId?: string;
  messageId?: string;
  stack?: string;
  retryCount: number;
  resolved: boolean;
}

/**
 * Analysis session interface
 */
export interface IAnalysisSession extends ISession {
  dataSource: DataSource;
  analysis: AnalysisProgress;
  results?: AnalysisResults;
}

/**
 * Data source
 */
export interface DataSource {
  type: 'database' | 'file' | 'api';
  location: string;
  filters?: Record<string, any>;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Analysis progress
 */
export interface AnalysisProgress {
  currentPhase: AnalysisPhase;
  phasesCompleted: AnalysisPhase[];
  percentComplete: number;
  itemsAnalyzed: number;
  insights: number;
  startTime: Date;
  estimatedCompletion?: Date;
}

/**
 * Analysis phases
 */
export enum AnalysisPhase {
  DATA_LOADING = 'data_loading',
  PREPROCESSING = 'preprocessing',
  PATTERN_DETECTION = 'pattern_detection',
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  TOPIC_MODELING = 'topic_modeling',
  USER_BEHAVIOR = 'user_behavior',
  REPORT_GENERATION = 'report_generation'
}

/**
 * Analysis results
 */
export interface AnalysisResults {
  summary: {
    totalMessages: number;
    totalUsers: number;
    totalGroups: number;
    dateRange: {
      start: Date;
      end: Date;
    };
  };
  insights: AnalysisInsight[];
  patterns: Pattern[];
  sentiment: SentimentAnalysis;
  topics: Topic[];
  recommendations: string[];
}

/**
 * Analysis insight
 */
export interface AnalysisInsight {
  type: InsightType;
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  data: Record<string, any>;
  visualizationType?: 'chart' | 'graph' | 'table' | 'heatmap';
}

/**
 * Insight types
 */
export enum InsightType {
  TREND = 'trend',
  ANOMALY = 'anomaly',
  CORRELATION = 'correlation',
  PREDICTION = 'prediction',
  RECOMMENDATION = 'recommendation'
}

/**
 * Pattern interface
 */
export interface Pattern {
  id: string;
  type: string;
  description: string;
  frequency: number;
  confidence: number;
  examples: any[];
}

/**
 * Sentiment analysis
 */
export interface SentimentAnalysis {
  overall: SentimentScore;
  byGroup: Record<string, SentimentScore>;
  byUser: Record<string, SentimentScore>;
  timeline: Array<{
    date: Date;
    sentiment: SentimentScore;
  }>;
}

/**
 * Sentiment score
 */
export interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
  compound: number;
}

/**
 * Topic interface
 */
export interface Topic {
  id: string;
  name: string;
  keywords: string[];
  relevance: number;
  messageCount: number;
  topContributors: string[];
}

/**
 * Session manager interface
 */
export interface ISessionManager {
  createSession(type: SessionType, metadata?: SessionMetadata): Promise<ISession>;
  getSession(sessionId: string): Promise<ISession | null>;
  getActiveSessions(): Promise<ISession[]>;
  updateSession(sessionId: string, updates: Partial<ISession>): Promise<void>;
  pauseSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;
  cleanupSessions(): Promise<number>;
}

/**
 * Session persistence interface
 */
export interface ISessionPersistence {
  save(session: ISession): Promise<void>;
  load(sessionId: string): Promise<ISession | null>;
  loadAll(): Promise<ISession[]>;
  delete(sessionId: string): Promise<void>;
  export(sessionId: string, format: 'json' | 'binary'): Promise<string>;
  import(data: string, format: 'json' | 'binary'): Promise<ISession>;
}

/**
 * Session recovery interface
 */
export interface ISessionRecovery {
  canRecover(session: ISession): boolean;
  recover(sessionId: string): Promise<ISession>;
  getRecoveryPoint(sessionId: string): Promise<RecoveryPoint | null>;
  createRecoveryPoint(session: ISession): Promise<void>;
  listRecoveryPoints(sessionId: string): Promise<RecoveryPoint[]>;
}

/**
 * Recovery point
 */
export interface RecoveryPoint {
  id: string;
  sessionId: string;
  timestamp: Date;
  state: any;
  description?: string;
}

/**
 * Session events
 */
export interface SessionEvent {
  sessionId: string;
  type: SessionEventType;
  timestamp: Date;
  data?: any;
}

/**
 * Session event types
 */
export enum SessionEventType {
  STARTED = 'started',
  PROGRESS = 'progress',
  PAUSED = 'paused',
  RESUMED = 'resumed',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ERROR = 'error',
  WARNING = 'warning'
}

/**
 * Session listener interface
 */
export interface ISessionListener {
  onSessionEvent(event: SessionEvent): void;
}

/**
 * Media interface (referenced in other types)
 */
export interface IMedia {
  id: string;
  messageId: string;
  type: MediaType;
  filename: string;
  size: number;
  mimeType: string;
  url?: string;
  localPath?: string;
  thumbnail?: string;
  duration?: number; // for audio/video
  dimensions?: {
    width: number;
    height: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Media types
 */
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  GIF = 'gif'
}