import { Member, Group, ExportData } from './models';

/**
 * Interface for storage services
 */
export interface IStorage {
  /**
   * Save group data
   */
  saveGroup(group: Group): Promise<void>;

  /**
   * Get group by ID
   */
  getGroup(groupId: string): Promise<Group | null>;

  /**
   * Get all groups
   */
  getAllGroups(): Promise<Group[]>;

  /**
   * Delete group
   */
  deleteGroup(groupId: string): Promise<void>;

  /**
   * Save member data
   */
  saveMember(member: Member): Promise<void>;

  /**
   * Save multiple members
   */
  saveMembers(members: Member[]): Promise<void>;

  /**
   * Get member by ID
   */
  getMember(memberId: string): Promise<Member | null>;

  /**
   * Get members by group
   */
  getMembersByGroup(groupId: string): Promise<Member[]>;

  /**
   * Search members
   */
  searchMembers(query: string, options?: SearchOptions): Promise<Member[]>;

  /**
   * Delete member
   */
  deleteMember(memberId: string): Promise<void>;

  /**
   * Save export data
   */
  saveExport(exportData: ExportData): Promise<void>;

  /**
   * Get export by ID
   */
  getExport(exportId: string): Promise<ExportData | null>;

  /**
   * Get exports by group
   */
  getExportsByGroup(groupId: string): Promise<ExportData[]>;

  /**
   * Delete export
   */
  deleteExport(exportId: string): Promise<void>;

  /**
   * Clear all data
   */
  clearAll(): Promise<void>;

  /**
   * Get storage statistics
   */
  getStatistics(): Promise<StorageStatistics>;

  /**
   * Backup data
   */
  backup(options?: BackupOptions): Promise<BackupResult>;

  /**
   * Restore from backup
   */
  restore(backupId: string): Promise<void>;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  fields?: string[];
  fuzzy?: boolean;
  caseSensitive?: boolean;
}

export interface StorageStatistics {
  totalGroups: number;
  totalMembers: number;
  totalExports: number;
  storageSize: number;
  lastBackup?: Date;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export interface BackupOptions {
  compressed?: boolean;
  encrypted?: boolean;
  encryptionKey?: string;
  includeExports?: boolean;
  excludeFields?: string[];
}

export interface BackupResult {
  id: string;
  path: string;
  size: number;
  createdAt: Date;
  compressed: boolean;
  encrypted: boolean;
  statistics: BackupStatistics;
}

export interface BackupStatistics {
  groupsBackedUp: number;
  membersBackedUp: number;
  exportsBackedUp: number;
}