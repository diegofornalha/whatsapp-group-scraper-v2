/**
 * Central type definitions and interfaces for WhatsApp Group Scraper
 * 
 * This file serves as the main export point for all type definitions
 * used throughout the application. It follows a modular architecture
 * where each module has its own interface definitions.
 */

// Core service interfaces
export * from './IService';

// Domain model interfaces
export * from './IMessage';
export * from './IGroup';
export * from './IUser';
export * from './ISession';

// Module interfaces
export * from './IExtractor';
export * from './IStorage';
export * from './IMonitor';
export * from './ISecurity';
export * from './IConfig';