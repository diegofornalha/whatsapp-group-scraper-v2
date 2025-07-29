/**
 * Core data models for WhatsApp Group Scraper
 */

/**
 * WhatsApp group member interface
 */
export interface Member {
  id: string;
  phoneNumber: string;
  countryCode?: string;
  displayName?: string;
  pushName?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  profilePictureUrl?: string;
  status?: string;
  joinedAt?: Date;
  lastSeen?: Date;
  isBusinessAccount?: boolean;
  metadata?: MemberMetadata;
  tags?: string[];
}

export interface MemberMetadata {
  verified?: boolean;
  about?: string;
  businessInfo?: BusinessInfo;
  customFields?: Record<string, any>;
}

export interface BusinessInfo {
  name?: string;
  category?: string;
  description?: string;
  email?: string;
  website?: string;
  address?: string;
}

/**
 * WhatsApp group interface
 */
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  createdBy?: string;
  pictureUrl?: string;
  memberCount: number;
  admins: string[];
  inviteLink?: string;
  isRestricted?: boolean;
  isAnnouncement?: boolean;
  metadata?: GroupMetadata;
}

export interface GroupMetadata {
  rules?: string[];
  categories?: string[];
  language?: string;
  location?: string;
  customFields?: Record<string, any>;
}

/**
 * Export data interface
 */
export interface ExportData {
  id: string;
  format: ExportFormat;
  group: Group;
  members: Member[];
  exportedAt: Date;
  exportedBy?: string;
  options: ExportOptions;
  statistics?: ExportStatistics;
}

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf' | 'html' | 'xml';

export interface ExportOptions {
  includeProfilePictures?: boolean;
  includeMetadata?: boolean;
  includeStatistics?: boolean;
  customTemplate?: string;
  filterCriteria?: Record<string, any>;
  sortOptions?: SortOptions;
}

export interface SortOptions {
  field: keyof Member | keyof Group;
  order: 'asc' | 'desc';
}

export interface ExportStatistics {
  totalMembers: number;
  totalAdmins: number;
  totalBusinessAccounts: number;
  membersByCountry?: Record<string, number>;
  joinDateDistribution?: DateDistribution;
  activityMetrics?: ActivityMetrics;
}

export interface DateDistribution {
  daily?: Record<string, number>;
  weekly?: Record<string, number>;
  monthly?: Record<string, number>;
}

export interface ActivityMetrics {
  activeLast24h?: number;
  activeLast7d?: number;
  activeLast30d?: number;
  inactiveMembers?: number;
}