/**
 * WhatsApp data extraction service with enhanced security and monitoring
 */

import { IExtractor, ExtractionOptions } from '../types/IExtractor';
import { IStorage } from '../types/IStorage';
import { ILogger } from '../types/ILogger';
import { Member } from '../types/models';
import { BaseService } from '../core/BaseService';
import { EventBus } from '../core/EventBus';
import { SecurityManager } from '../core/security/SecurityManager';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { ServiceStatus } from '../types/IService';

export class WhatsAppExtractorService extends BaseService implements IExtractor {
    private modalObserver: MutationObserver | null = null;
    private extractionInProgress = false;
    private extractedCount = 0;

    constructor(
        eventBus: EventBus,
        logger: ILogger,
        private securityManager: SecurityManager,
        private storage: IStorage,
        private metricsCollector: MetricsCollector
    ) {
        super('WhatsAppExtractorService', eventBus, logger);
    }

    async startExtraction(options: ExtractionOptions): Promise<void> {
        if (this.extractionInProgress) {
            this.logger.warn('Extraction already in progress');
            return;
        }

        this.logger.info('Starting WhatsApp extraction', { options });
        this.extractionInProgress = true;
        this.extractedCount = 0;

        try {
            // Security check
            const securityCheck = await this.securityManager.checkSecurity(
                'extraction-start',
                options,
                { source: 'WhatsAppExtractor' }
            );

            if (!securityCheck.allowed) {
                throw new Error(`Security check failed: ${securityCheck.reasons.join(', ')}`);
            }

            // Set up modal monitoring
            if (options.modal) {
                await this.monitorModal(options.modal);
            }

            this.eventBus.emit('extraction:started', { options });
            this.metricsCollector.incrementCounter('extraction.sessions', 1);

        } catch (error) {
            this.logger.error('Failed to start extraction', error as Error);
            this.extractionInProgress = false;
            throw error;
        }
    }

    async stopExtraction(): Promise<void> {
        if (!this.extractionInProgress) {
            return;
        }

        this.logger.info('Stopping extraction', { extractedCount: this.extractedCount });
        
        if (this.modalObserver) {
            this.modalObserver.disconnect();
            this.modalObserver = null;
        }

        this.extractionInProgress = false;
        this.eventBus.emit('extraction:stopped', { 
            extractedCount: this.extractedCount 
        });
    }

    async extractMember(element: HTMLElement): Promise<Member | null> {
        try {
            const memberData = this.parseMemberElement(element);
            if (!memberData) {
                return null;
            }

            // Validate extracted data
            const validation = await this.securityManager.inputValidator.validate(memberData, {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    phoneNumber: { type: 'string', pattern: '^[+]?[0-9\\s-()]+$' },
                    description: { type: 'string', maxLength: 500 }
                }
            });

            if (!validation.isValid) {
                this.logger.warn('Invalid member data extracted', { 
                    errors: validation.errors 
                });
                return null;
            }

            // Create member object
            const member: Member = {
                id: memberData.phoneNumber || memberData.name || `unknown-${Date.now()}`,
                name: memberData.name,
                phoneNumber: memberData.phoneNumber,
                description: memberData.description,
                extractedAt: new Date(),
                source: this.getCurrentGroupName()
            };

            // Store member
            await this.storage.addMember(member);
            this.extractedCount++;

            // Emit event
            this.eventBus.emit('member:extracted', { 
                member, 
                source: this.name 
            });

            // Update metrics
            this.metricsCollector.incrementCounter('members.extracted', 1);

            return member;

        } catch (error) {
            this.logger.error('Failed to extract member', error as Error);
            this.metricsCollector.incrementCounter('extraction.errors', 1);
            return null;
        }
    }

    private async monitorModal(modal: HTMLElement): Promise<void> {
        const targetNode = modal.querySelector('div[style*="height"]');
        if (!targetNode) {
            this.logger.warn('Modal structure not recognized');
            return;
        }

        const config = { 
            attributes: true, 
            childList: true, 
            subtree: true 
        };

        this.modalObserver = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && 
                    mutation.target instanceof HTMLElement &&
                    mutation.target.getAttribute('role') === 'listitem') {
                    
                    // Use setTimeout to wait for data to be fully loaded
                    setTimeout(() => {
                        this.extractMember(mutation.target as HTMLElement);
                    }, 10);
                }
            }
        });

        this.modalObserver.observe(targetNode, config);
        this.logger.info('Started monitoring modal for changes');
    }

    private parseMemberElement(element: HTMLElement): {
        name?: string;
        phoneNumber?: string;
        description?: string;
    } | null {
        let name: string | undefined;
        let phoneNumber: string | undefined;
        let description: string | undefined;

        // Extract name
        const nameElem = element.querySelector('span[title]:not(.copyable-text)');
        if (nameElem?.textContent) {
            name = this.cleanName(nameElem.textContent);
        }

        if (!name) {
            return null;
        }

        // Extract phone number
        const phoneElem = element.querySelector('span[style*="height"]:not([title])');
        if (phoneElem?.textContent) {
            phoneNumber = phoneElem.textContent.trim();
        }

        // Extract description
        const descElem = element.querySelector('span[title].copyable-text');
        if (descElem?.textContent) {
            description = this.cleanDescription(descElem.textContent);
        }

        return { name, phoneNumber, description };
    }

    private cleanName(name: string): string {
        return name.trim().replace(/^~\s*/, '');
    }

    private cleanDescription(desc: string): string | undefined {
        const cleaned = desc.trim();
        const ignoredPatterns = [
            /Loading About/i,
            /I am using WhatsApp/i,
            /Available/i
        ];

        if (ignoredPatterns.some(pattern => pattern.test(cleaned))) {
            return undefined;
        }

        return cleaned;
    }

    private getCurrentGroupName(): string | undefined {
        const groupNameNode = document.querySelector(
            'header span[style*="height"]:not(.copyable-text)'
        );
        return groupNameNode?.textContent || undefined;
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('WhatsApp extractor service initialized');
    }

    protected async onStart(): Promise<void> {
        this.logger.info('WhatsApp extractor service started');
        this.status = ServiceStatus.RUNNING;
    }

    protected async onStop(): Promise<void> {
        await this.stopExtraction();
        this.logger.info('WhatsApp extractor service stopped');
    }

    protected async onDispose(): Promise<void> {
        if (this.modalObserver) {
            this.modalObserver.disconnect();
        }
        this.logger.info('WhatsApp extractor service disposed');
    }
}