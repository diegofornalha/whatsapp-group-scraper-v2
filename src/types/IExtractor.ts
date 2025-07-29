/**
 * Core extractor interfaces for WhatsApp data extraction
 */

import { IMessage, IGroup, IUser, IMedia } from './index';

/**
 * Base interface for all extractors
 */
export interface IExtractor {
  name: string;
  version: string;
  isEnabled: boolean;
  
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * Message extractor interface
 */
export interface IMessageExtractor extends IExtractor {
  extractMessages(groupId: string, options?: ExtractOptions): Promise<IMessage[]>;
  extractMessage(messageId: string): Promise<IMessage | null>;
  extractMessagesInDateRange(groupId: string, startDate: Date, endDate: Date): Promise<IMessage[]>;
}

/**
 * Group extractor interface
 */
export interface IGroupExtractor extends IExtractor {
  extractGroups(): Promise<IGroup[]>;
  extractGroup(groupId: string): Promise<IGroup | null>;
  extractGroupMembers(groupId: string): Promise<IUser[]>;
  extractGroupMetadata(groupId: string): Promise<GroupMetadata>;
}

/**
 * Media extractor interface
 */
export interface IMediaExtractor extends IExtractor {
  extractMedia(messageId: string): Promise<IMedia[]>;
  extractMediaFromGroup(groupId: string, options?: MediaExtractOptions): Promise<IMedia[]>;
  downloadMedia(media: IMedia, destination: string): Promise<void>;
}

/**
 * User extractor interface
 */
export interface IUserExtractor extends IExtractor {
  extractUser(userId: string): Promise<IUser | null>;
  extractUsers(groupId: string): Promise<IUser[]>;
  extractUserActivity(userId: string, groupId: string): Promise<UserActivity>;
}

/**
 * Extraction options
 */
export interface ExtractOptions {
  limit?: number;
  offset?: number;
  filter?: MessageFilter;
  includeMedia?: boolean;
  includeDeleted?: boolean;
}

/**
 * Media extraction options
 */
export interface MediaExtractOptions {
  types?: MediaType[];
  maxSize?: number;
  dateRange?: { start: Date; end: Date };
}

/**
 * Message filter interface
 */
export interface MessageFilter {
  userId?: string;
  keyword?: string;
  hasMedia?: boolean;
  messageType?: MessageType[];
  dateRange?: { start: Date; end: Date };
}

/**
 * Group metadata interface
 */
export interface GroupMetadata {
  created: Date;
  lastActivity: Date;
  messageCount: number;
  memberCount: number;
  admins: string[];
  description?: string;
  rules?: string[];
}

/**
 * User activity interface
 */
export interface UserActivity {
  messageCount: number;
  firstMessage: Date;
  lastMessage: Date;
  mediaShared: number;
  averageMessageLength: number;
  activityByHour: Record<number, number>;
  activityByDay: Record<string, number>;
}

/**
 * Media types enum
 */
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  GIF = 'gif'
}

/**
 * Message types enum
 */
export enum MessageType {
  TEXT = 'text',
  MEDIA = 'media',
  DELETED = 'deleted',
  EDITED = 'edited',
  SYSTEM = 'system',
  POLL = 'poll',
  LOCATION = 'location'
}

/**
 * Extractor factory interface
 */
export interface IExtractorFactory {
  createMessageExtractor(): IMessageExtractor;
  createGroupExtractor(): IGroupExtractor;
  createMediaExtractor(): IMediaExtractor;
  createUserExtractor(): IUserExtractor;
}