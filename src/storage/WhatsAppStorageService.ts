/**
 * Storage service for WhatsApp members with persistence and security
 */

import { IStorage, StorageStats } from '../types/IStorage';
import { Member, Group, ExportData } from '../types/models';
import { BaseService } from '../core/BaseService';
import { EventBus } from '../core/EventBus';
import { ILogger } from '../types/ILogger';
import { SecurityManager } from '../core/security/SecurityManager';
import { ServiceStatus } from '../types/IService';
import { ListStorage, exportToCsv } from 'browser-scraping-utils';

interface StoredMember extends Member {
    profileId: string;
}

export class WhatsAppStorageService extends BaseService implements IStorage {
    private storage: ListStorage<StoredMember>;
    private memberMap: Map<string, Member> = new Map();

    constructor(
        eventBus: EventBus,
        logger: ILogger,
        private securityManager: SecurityManager
    ) {
        super('WhatsAppStorageService', eventBus, logger);
        
        // Initialize browser storage
        this.storage = new ListStorage<StoredMember>({
            name: 'whatsapp-scraper'
        });
    }

    async addMember(member: Member): Promise<void> {
        try {
            // Security check
            const securityCheck = await this.securityManager.checkSecurity(
                'storage-add',
                { member },
                { source: 'WhatsAppStorage' }
            );

            if (!securityCheck.allowed) {
                throw new Error(`Security check failed: ${securityCheck.reasons.join(', ')}`);
            }

            // Store in browser storage
            const storedMember: StoredMember = {
                ...member,
                profileId: member.id
            };

            await this.storage.addElem(
                member.id,
                storedMember,
                true // Update if exists
            );

            // Store in memory map
            this.memberMap.set(member.id, member);

            // Emit event
            this.eventBus.emit('storage:member:added', { member });
            
            this.logger.debug('Member added to storage', { 
                id: member.id,
                name: member.name 
            });

        } catch (error) {
            this.logger.error('Failed to add member', error as Error);
            throw error;
        }
    }

    async getMember(id: string): Promise<Member | null> {
        try {
            // Try memory first
            const cached = this.memberMap.get(id);
            if (cached) {
                return cached;
            }

            // Try browser storage
            const stored = await this.storage.getElem(id);
            if (stored) {
                const member: Member = {
                    id: stored.id,
                    name: stored.name,
                    phoneNumber: stored.phoneNumber,
                    description: stored.description,
                    extractedAt: stored.extractedAt,
                    source: stored.source
                };
                
                // Cache in memory
                this.memberMap.set(id, member);
                return member;
            }

            return null;

        } catch (error) {
            this.logger.error('Failed to get member', error as Error);
            return null;
        }
    }

    async getAllMembers(): Promise<Member[]> {
        try {
            const allMembers = await this.storage.getAll();
            return allMembers.map(stored => ({
                id: stored.id,
                name: stored.name,
                phoneNumber: stored.phoneNumber,
                description: stored.description,
                extractedAt: stored.extractedAt,
                source: stored.source
            }));
        } catch (error) {
            this.logger.error('Failed to get all members', error as Error);
            return [];
        }
    }

    async removeMember(id: string): Promise<void> {
        try {
            await this.storage.deleteElem(id);
            this.memberMap.delete(id);
            
            this.eventBus.emit('storage:member:removed', { id });
            this.logger.debug('Member removed from storage', { id });

        } catch (error) {
            this.logger.error('Failed to remove member', error as Error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            // Security check
            const securityCheck = await this.securityManager.checkSecurity(
                'storage-clear',
                {},
                { source: 'WhatsAppStorage' }
            );

            if (!securityCheck.allowed) {
                throw new Error(`Security check failed: ${securityCheck.reasons.join(', ')}`);
            }

            await this.storage.clear();
            this.memberMap.clear();
            
            this.eventBus.emit('storage:cleared', {});
            this.logger.info('Storage cleared');

        } catch (error) {
            this.logger.error('Failed to clear storage', error as Error);
            throw error;
        }
    }

    async exportData(format: 'csv' | 'json' = 'csv'): Promise<ExportData> {
        try {
            // Security check
            const securityCheck = await this.securityManager.checkSecurity(
                'storage-export',
                { format },
                { source: 'WhatsAppStorage' }
            );

            if (!securityCheck.allowed) {
                throw new Error(`Security check failed: ${securityCheck.reasons.join(', ')}`);
            }

            const members = await this.getAllMembers();
            const timestamp = new Date().toISOString();

            if (format === 'csv') {
                const csvData = await this.storage.toCsvData();
                
                // Export file
                const filename = `whatsapp-export-${timestamp}.csv`;
                exportToCsv(filename, csvData);

                return {
                    format: 'csv',
                    data: csvData,
                    metadata: {
                        exportedAt: new Date(),
                        totalMembers: members.length,
                        filename
                    }
                };
            } else {
                const jsonData = {
                    exportedAt: timestamp,
                    totalMembers: members.length,
                    members
                };

                return {
                    format: 'json',
                    data: JSON.stringify(jsonData, null, 2),
                    metadata: {
                        exportedAt: new Date(),
                        totalMembers: members.length
                    }
                };
            }

        } catch (error) {
            this.logger.error('Failed to export data', error as Error);
            throw error;
        }
    }

    async getStats(): Promise<StorageStats> {
        try {
            const count = await this.storage.getCount();
            const members = await this.getAllMembers();
            
            const sources = new Set<string>();
            members.forEach(m => {
                if (m.source) sources.add(m.source);
            });

            return {
                totalMembers: count,
                totalGroups: sources.size,
                lastUpdated: new Date()
            };

        } catch (error) {
            this.logger.error('Failed to get stats', error as Error);
            return {
                totalMembers: 0,
                totalGroups: 0,
                lastUpdated: new Date()
            };
        }
    }

    protected async onInitialize(): Promise<void> {
        // Load existing data into memory
        const existing = await this.storage.getAll();
        existing.forEach(member => {
            this.memberMap.set(member.id, member);
        });
        
        this.logger.info('Storage service initialized', {
            existingMembers: existing.length
        });
    }

    protected async onStart(): Promise<void> {
        this.status = ServiceStatus.RUNNING;
        this.logger.info('Storage service started');
    }

    protected async onStop(): Promise<void> {
        // Ensure all data is persisted
        this.logger.info('Storage service stopped');
    }

    protected async onDispose(): Promise<void> {
        this.memberMap.clear();
        this.logger.info('Storage service disposed');
    }
}