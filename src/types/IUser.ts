/**
 * Core user interfaces
 */

/**
 * Base user interface
 */
export interface IUser {
  id: string;
  phoneNumber: string;
  name: string;
  displayName?: string;
  avatar?: string;
  status?: string;
  lastSeen?: Date;
  isOnline: boolean;
  isVerified: boolean;
  isBlocked: boolean;
  createdAt: Date;
  metadata?: UserMetadata;
}

/**
 * User metadata
 */
export interface UserMetadata {
  about?: string;
  language?: string;
  timezone?: string;
  groups: string[];
  totalMessages: number;
  totalMedia: number;
  firstSeen: Date;
  tags?: string[];
  customFields?: Record<string, any>;
}

/**
 * User profile interface
 */
export interface IUserProfile extends IUser {
  email?: string;
  businessProfile?: BusinessProfile;
  preferences: UserPreferences;
  privacySettings: PrivacySettings;
  notificationSettings: NotificationSettings;
}

/**
 * Business profile
 */
export interface BusinessProfile {
  businessName: string;
  category: string;
  description?: string;
  email?: string;
  website?: string;
  address?: string;
  hours?: BusinessHours[];
  verified: boolean;
}

/**
 * Business hours
 */
export interface BusinessHours {
  day: DayOfWeek;
  open: string;
  close: string;
  isOpen: boolean;
}

/**
 * Days of week
 */
export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  mediaAutoDownload: {
    images: boolean;
    videos: boolean;
    documents: boolean;
  };
  chatWallpaper?: string;
  fontSize: 'small' | 'medium' | 'large';
  enterToSend: boolean;
}

/**
 * Privacy settings
 */
export interface PrivacySettings {
  lastSeen: PrivacyOption;
  profilePhoto: PrivacyOption;
  status: PrivacyOption;
  groups: PrivacyOption;
  readReceipts: boolean;
  typingIndicators: boolean;
  onlineStatus: boolean;
  blockedUsers: string[];
}

/**
 * Privacy options
 */
export enum PrivacyOption {
  EVERYONE = 'everyone',
  CONTACTS = 'contacts',
  NOBODY = 'nobody',
  CUSTOM = 'custom'
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  enabled: boolean;
  messageNotifications: boolean;
  groupNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  previewText: boolean;
  mutedGroups: string[];
  mutedUsers: string[];
  customNotificationSounds: Record<string, string>;
}

/**
 * User activity interface
 */
export interface IUserActivity {
  userId: string;
  messagesSent: number;
  messagesReceived: number;
  mediaShared: number;
  groupsJoined: number;
  groupsLeft: number;
  lastMessageAt?: Date;
  activityByHour: Record<number, number>;
  activityByDay: Record<string, number>;
  topGroups: Array<{
    groupId: string;
    messageCount: number;
  }>;
  responseTime: {
    average: number; // minutes
    median: number;
    fastest: number;
  };
}

/**
 * User statistics
 */
export interface UserStatistics {
  userId: string;
  totalGroups: number;
  activeGroups: number;
  messagesPerDay: number;
  averageMessageLength: number;
  emojiUsage: Record<string, number>;
  mediaTypes: {
    images: number;
    videos: number;
    documents: number;
    audio: number;
    stickers: number;
  };
  peakActivityHour: number;
  engagement: {
    replyRate: number;
    mentionRate: number;
    reactionRate: number;
  };
}

/**
 * User relationship interface
 */
export interface IUserRelationship {
  userId: string;
  relatedUserId: string;
  type: RelationshipType;
  commonGroups: string[];
  interactionCount: number;
  firstInteraction: Date;
  lastInteraction: Date;
  strength: number; // 0-100
}

/**
 * Relationship types
 */
export enum RelationshipType {
  CONTACT = 'contact',
  FREQUENT = 'frequent',
  OCCASIONAL = 'occasional',
  RARE = 'rare'
}

/**
 * User device interface
 */
export interface IUserDevice {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: DeviceType;
  platform: string;
  appVersion: string;
  lastActive: Date;
  isActive: boolean;
  pushToken?: string;
}

/**
 * Device types
 */
export enum DeviceType {
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
  WEB = 'web',
  TABLET = 'tablet'
}

/**
 * User session interface
 */
export interface IUserSession {
  id: string;
  userId: string;
  deviceId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}

/**
 * User search result
 */
export interface UserSearchResult {
  user: IUser;
  score: number;
  matchedFields: string[];
  commonGroups?: string[];
  mutualContacts?: number;
}

/**
 * User export data
 */
export interface IUserExportData {
  profile: IUserProfile;
  groups: Array<{
    groupId: string;
    groupName: string;
    role: string;
    joinedAt: Date;
  }>;
  messages: {
    sent: number;
    received: number;
    byGroup: Record<string, number>;
  };
  media: {
    shared: number;
    received: number;
    totalSize: number;
  };
  contacts: string[];
  blockedUsers: string[];
  exportDate: Date;
}

/**
 * User import options
 */
export interface UserImportOptions {
  mergeExisting: boolean;
  overwriteProfile: boolean;
  importMessages: boolean;
  importMedia: boolean;
  importContacts: boolean;
  importSettings: boolean;
}

/**
 * User verification interface
 */
export interface IUserVerification {
  userId: string;
  verificationType: VerificationType;
  verifiedAt: Date;
  verifiedBy: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Verification types
 */
export enum VerificationType {
  PHONE = 'phone',
  EMAIL = 'email',
  BUSINESS = 'business',
  OFFICIAL = 'official',
  CELEBRITY = 'celebrity'
}

/**
 * User moderation interface
 */
export interface IUserModeration {
  userId: string;
  warnings: number;
  restrictions: UserRestriction[];
  reportCount: number;
  lastReportedAt?: Date;
  moderationNotes: string[];
}

/**
 * User restriction
 */
export interface UserRestriction {
  type: RestrictionType;
  reason: string;
  appliedAt: Date;
  appliedBy: string;
  expiresAt?: Date;
  groupId?: string;
}

/**
 * Restriction types
 */
export enum RestrictionType {
  MUTED = 'muted',
  BANNED = 'banned',
  LIMITED = 'limited',
  READ_ONLY = 'read_only'
}