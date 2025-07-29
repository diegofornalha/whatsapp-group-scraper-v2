/**
 * Core group interfaces
 */

import { IUser } from './index';

/**
 * Base group interface
 */
export interface IGroup {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  createdAt: Date;
  createdBy: string;
  members: string[];
  admins: string[];
  settings: GroupSettings;
  metadata?: GroupMetadata;
  isActive: boolean;
  lastActivity?: Date;
}

/**
 * Group settings
 */
export interface GroupSettings {
  isPublic: boolean;
  joinApproval: boolean;
  onlyAdminsCanPost: boolean;
  onlyAdminsCanEditInfo: boolean;
  onlyAdminsCanAddMembers: boolean;
  disappearingMessages?: DisappearingMessageSettings;
  mediaVisibility: 'all' | 'admins' | 'none';
  messageRetention?: number; // days
}

/**
 * Disappearing message settings
 */
export interface DisappearingMessageSettings {
  enabled: boolean;
  duration: number; // seconds
}

/**
 * Group metadata
 */
export interface GroupMetadata {
  messageCount: number;
  mediaCount: number;
  linkCount: number;
  documentCount: number;
  memberCount: number;
  activeMembers: number;
  pinnedMessages?: string[];
  tags?: string[];
  category?: GroupCategory;
  language?: string;
  timezone?: string;
}

/**
 * Group categories
 */
export enum GroupCategory {
  PERSONAL = 'personal',
  WORK = 'work',
  EDUCATION = 'education',
  COMMUNITY = 'community',
  ENTERTAINMENT = 'entertainment',
  NEWS = 'news',
  SUPPORT = 'support',
  OTHER = 'other'
}

/**
 * Group member interface
 */
export interface IGroupMember {
  userId: string;
  groupId: string;
  role: MemberRole;
  joinedAt: Date;
  addedBy?: string;
  permissions: MemberPermission[];
  status: MemberStatus;
  lastSeen?: Date;
  nickname?: string;
  isMuted: boolean;
  muteUntil?: Date;
}

/**
 * Member roles
 */
export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
  GUEST = 'guest'
}

/**
 * Member permissions
 */
export enum MemberPermission {
  SEND_MESSAGES = 'send_messages',
  SEND_MEDIA = 'send_media',
  ADD_MEMBERS = 'add_members',
  REMOVE_MEMBERS = 'remove_members',
  CHANGE_GROUP_INFO = 'change_group_info',
  DELETE_MESSAGES = 'delete_messages',
  PIN_MESSAGES = 'pin_messages',
  MANAGE_ADMINS = 'manage_admins'
}

/**
 * Member status
 */
export enum MemberStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LEFT = 'left',
  REMOVED = 'removed',
  BANNED = 'banned'
}

/**
 * Group invitation interface
 */
export interface IGroupInvitation {
  id: string;
  groupId: string;
  inviteLink: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  requiresApproval: boolean;
}

/**
 * Group statistics
 */
export interface GroupStatistics {
  groupId: string;
  totalMessages: number;
  messagesPerDay: Record<string, number>;
  messagesPerHour: Record<number, number>;
  topContributors: Array<{
    userId: string;
    messageCount: number;
    percentage: number;
  }>;
  mediaDistribution: {
    images: number;
    videos: number;
    documents: number;
    audio: number;
    stickers: number;
  };
  activityTrend: 'increasing' | 'stable' | 'decreasing';
  averageResponseTime: number; // minutes
  engagement: {
    activeUsers: number;
    lurkers: number;
    engagementRate: number;
  };
}

/**
 * Group activity log entry
 */
export interface GroupActivityLog {
  id: string;
  groupId: string;
  action: GroupAction;
  performedBy: string;
  targetUser?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

/**
 * Group actions for activity log
 */
export enum GroupAction {
  CREATED = 'created',
  NAME_CHANGED = 'name_changed',
  DESCRIPTION_CHANGED = 'description_changed',
  AVATAR_CHANGED = 'avatar_changed',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_LEFT = 'member_left',
  ADMIN_ADDED = 'admin_added',
  ADMIN_REMOVED = 'admin_removed',
  SETTINGS_CHANGED = 'settings_changed',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGE_PINNED = 'message_pinned',
  MESSAGE_UNPINNED = 'message_unpinned'
}

/**
 * Group search result
 */
export interface GroupSearchResult {
  group: IGroup;
  score: number;
  matchedFields: string[];
  snippet?: string;
}

/**
 * Group join request
 */
export interface IGroupJoinRequest {
  id: string;
  groupId: string;
  userId: string;
  requestedAt: Date;
  message?: string;
  status: JoinRequestStatus;
  processedBy?: string;
  processedAt?: Date;
  rejectionReason?: string;
}

/**
 * Join request status
 */
export enum JoinRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  WITHDRAWN = 'withdrawn'
}

/**
 * Group rules interface
 */
export interface IGroupRules {
  groupId: string;
  rules: GroupRule[];
  lastUpdated: Date;
  updatedBy: string;
}

/**
 * Individual group rule
 */
export interface GroupRule {
  id: string;
  title: string;
  description: string;
  order: number;
  isActive: boolean;
  enforcement: 'strict' | 'moderate' | 'lenient';
}

/**
 * Group announcement
 */
export interface IGroupAnnouncement {
  id: string;
  groupId: string;
  title: string;
  content: string;
  author: string;
  createdAt: Date;
  expiresAt?: Date;
  isPinned: boolean;
  readBy: string[];
  important: boolean;
}

/**
 * Group backup interface
 */
export interface IGroupBackup {
  id: string;
  groupId: string;
  createdAt: Date;
  size: number;
  includesMedia: boolean;
  messageCount: number;
  memberCount: number;
  status: BackupStatus;
  downloadUrl?: string;
  expiresAt?: Date;
}

/**
 * Backup status
 */
export enum BackupStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

/**
 * Group moderation settings
 */
export interface GroupModerationSettings {
  groupId: string;
  autoModeration: {
    enabled: boolean;
    spamFilter: boolean;
    profanityFilter: boolean;
    linkFilter: boolean;
    mediaFilter: boolean;
  };
  blacklistedWords: string[];
  whitelistedDomains: string[];
  maxMessageLength?: number;
  rateLimiting: {
    enabled: boolean;
    messagesPerMinute: number;
    cooldownMinutes: number;
  };
}

/**
 * Group export options
 */
export interface GroupExportOptions {
  includeMessages: boolean;
  includeMedia: boolean;
  includeMembers: boolean;
  includeSettings: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  format: 'json' | 'csv' | 'zip';
  encryption?: {
    enabled: boolean;
    password?: string;
  };
}