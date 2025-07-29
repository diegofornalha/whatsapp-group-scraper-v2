/**
 * Core message interfaces
 */

import { IUser, IMedia } from './index';

/**
 * Base message interface
 */
export interface IMessage {
  id: string;
  groupId: string;
  userId: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  isDeleted: boolean;
  isEdited: boolean;
  editedAt?: Date;
  replyTo?: string;
  mentions?: string[];
  reactions?: MessageReaction[];
  media?: IMedia[];
  metadata?: MessageMetadata;
}

/**
 * Message types
 */
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  GIF = 'gif',
  LOCATION = 'location',
  CONTACT = 'contact',
  POLL = 'poll',
  SYSTEM = 'system',
  DELETED = 'deleted'
}

/**
 * Message reaction interface
 */
export interface MessageReaction {
  emoji: string;
  userId: string;
  timestamp: Date;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  forwarded?: boolean;
  forwardedFrom?: string;
  edited?: boolean;
  editHistory?: EditEntry[];
  viewOnce?: boolean;
  ephemeral?: boolean;
  ephemeralDuration?: number;
  isRead?: boolean;
  readBy?: ReadReceipt[];
  deliveredTo?: string[];
}

/**
 * Edit history entry
 */
export interface EditEntry {
  content: string;
  editedAt: Date;
  editedBy: string;
}

/**
 * Read receipt
 */
export interface ReadReceipt {
  userId: string;
  readAt: Date;
}

/**
 * System message interface
 */
export interface ISystemMessage extends IMessage {
  systemType: SystemMessageType;
  affectedUsers?: string[];
  systemData?: Record<string, any>;
}

/**
 * System message types
 */
export enum SystemMessageType {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USER_ADDED = 'user_added',
  USER_REMOVED = 'user_removed',
  GROUP_CREATED = 'group_created',
  GROUP_NAME_CHANGED = 'group_name_changed',
  GROUP_ICON_CHANGED = 'group_icon_changed',
  GROUP_DESCRIPTION_CHANGED = 'group_description_changed',
  ADMIN_ADDED = 'admin_added',
  ADMIN_REMOVED = 'admin_removed',
  ENCRYPTION_CHANGED = 'encryption_changed',
  DISAPPEARING_MESSAGES = 'disappearing_messages',
  CALL_STARTED = 'call_started',
  CALL_ENDED = 'call_ended'
}

/**
 * Poll message interface
 */
export interface IPollMessage extends IMessage {
  poll: Poll;
}

/**
 * Poll interface
 */
export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  allowMultipleAnswers: boolean;
  isAnonymous: boolean;
  expiresAt?: Date;
  createdBy: string;
  totalVotes: number;
}

/**
 * Poll option
 */
export interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters?: string[];
}

/**
 * Location message interface
 */
export interface ILocationMessage extends IMessage {
  location: Location;
}

/**
 * Location interface
 */
export interface Location {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  url?: string;
}

/**
 * Contact message interface
 */
export interface IContactMessage extends IMessage {
  contact: Contact;
}

/**
 * Contact interface
 */
export interface Contact {
  name: string;
  phoneNumber: string;
  email?: string;
  organization?: string;
  vcard?: string;
}

/**
 * Message thread interface
 */
export interface IMessageThread {
  rootMessageId: string;
  messages: IMessage[];
  participants: string[];
  lastActivity: Date;
  messageCount: number;
}

/**
 * Message search result
 */
export interface MessageSearchResult {
  message: IMessage;
  score: number;
  highlights: TextHighlight[];
  context?: {
    before: IMessage[];
    after: IMessage[];
  };
}

/**
 * Text highlight for search results
 */
export interface TextHighlight {
  start: number;
  end: number;
  field: string;
}

/**
 * Message statistics
 */
export interface MessageStats {
  totalMessages: number;
  messagesByType: Record<MessageType, number>;
  messagesByUser: Record<string, number>;
  messagesByDay: Record<string, number>;
  messagesByHour: Record<number, number>;
  averageMessageLength: number;
  mostActiveUsers: Array<{ userId: string; count: number }>;
  mostUsedEmojis: Array<{ emoji: string; count: number }>;
  mediaStats: {
    images: number;
    videos: number;
    documents: number;
    audio: number;
  };
}

/**
 * Message export format
 */
export interface MessageExport {
  message: IMessage;
  user: IUser;
  formattedDate: string;
  formattedTime: string;
  mediaFiles?: string[];
}

/**
 * Bulk message operations interface
 */
export interface IBulkMessageOperations {
  exportMessages(messages: IMessage[], format: ExportFormat): Promise<string>;
  deleteMessages(messageIds: string[]): Promise<number>;
  archiveMessages(messageIds: string[]): Promise<number>;
  markAsRead(messageIds: string[], userId: string): Promise<number>;
}

/**
 * Export format options
 */
export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  TXT = 'txt',
  HTML = 'html',
  PDF = 'pdf'
}

/**
 * Message notification interface
 */
export interface IMessageNotification {
  messageId: string;
  groupId: string;
  groupName: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  type: MessageType;
  hasMedia: boolean;
  isMentioned: boolean;
}

/**
 * Message delivery status
 */
export enum MessageDeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

/**
 * Message delivery info
 */
export interface MessageDeliveryInfo {
  messageId: string;
  status: MessageDeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
}