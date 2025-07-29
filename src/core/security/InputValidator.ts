/**
 * Input Validator
 * Validates and sanitizes user input to prevent security vulnerabilities
 */

import { logger } from '../../utils/logger';

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'date' | 'array' | 'object' | 'custom';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  sanitize?: boolean;
  customValidator?: (value: any) => boolean | string;
  transform?: (value: any) => any;
}

export interface ValidationSchema {
  [field: string]: ValidationRule | ValidationSchema;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitized: any;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export class InputValidator {
  private sanitizers: Map<string, (value: any) => any> = new Map();

  constructor() {
    this.initializeSanitizers();
  }

  /**
   * Initialize default sanitizers
   */
  private initializeSanitizers(): void {
    // HTML sanitizer
    this.sanitizers.set('html', (value: string) => {
      if (typeof value !== 'string') return value;
      return value
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    });

    // SQL sanitizer
    this.sanitizers.set('sql', (value: string) => {
      if (typeof value !== 'string') return value;
      return value.replace(/['"\\;`]/g, '');
    });

    // Path sanitizer
    this.sanitizers.set('path', (value: string) => {
      if (typeof value !== 'string') return value;
      return value.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
    });

    // Trim whitespace
    this.sanitizers.set('trim', (value: string) => {
      if (typeof value !== 'string') return value;
      return value.trim();
    });

    // Remove non-alphanumeric
    this.sanitizers.set('alphanumeric', (value: string) => {
      if (typeof value !== 'string') return value;
      return value.replace(/[^a-zA-Z0-9]/g, '');
    });

    // Normalize whitespace
    this.sanitizers.set('normalizeWhitespace', (value: string) => {
      if (typeof value !== 'string') return value;
      return value.replace(/\s+/g, ' ').trim();
    });
  }

  /**
   * Validate input against schema
   */
  public validate(input: any, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitized = this.validateObject(input, schema, '', errors);

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Validate object recursively
   */
  private validateObject(
    obj: any,
    schema: ValidationSchema,
    path: string,
    errors: ValidationError[]
  ): any {
    const result: any = {};

    // Check for unknown fields
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (!schema.hasOwnProperty(key)) {
          logger.warn(`Unknown field in input: ${path ? `${path}.${key}` : key}`);
        }
      }
    }

    // Validate each field
    for (const field in schema) {
      const rule = schema[field];
      const fieldPath = path ? `${path}.${field}` : field;
      const value = obj ? obj[field] : undefined;

      if (this.isValidationRule(rule)) {
        const validated = this.validateField(value, rule as ValidationRule, fieldPath, errors);
        if (validated !== undefined) {
          result[field] = validated;
        }
      } else {
        // Nested object validation
        result[field] = this.validateObject(value, rule as ValidationSchema, fieldPath, errors);
      }
    }

    return result;
  }

  /**
   * Check if object is a validation rule
   */
  private isValidationRule(obj: any): boolean {
    return obj && typeof obj === 'object' && 'type' in obj;
  }

  /**
   * Validate individual field
   */
  private validateField(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): any {
    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        message: `${field} is required`,
        value
      });
      return undefined;
    }

    // Skip validation if not required and empty
    if (!rule.required && (value === undefined || value === null)) {
      return undefined;
    }

    // Type validation
    let validated = value;
    switch (rule.type) {
      case 'string':
        validated = this.validateString(value, rule, field, errors);
        break;
      case 'number':
        validated = this.validateNumber(value, rule, field, errors);
        break;
      case 'boolean':
        validated = this.validateBoolean(value, rule, field, errors);
        break;
      case 'email':
        validated = this.validateEmail(value, rule, field, errors);
        break;
      case 'url':
        validated = this.validateUrl(value, rule, field, errors);
        break;
      case 'date':
        validated = this.validateDate(value, rule, field, errors);
        break;
      case 'array':
        validated = this.validateArray(value, rule, field, errors);
        break;
      case 'object':
        validated = this.validateObjectType(value, rule, field, errors);
        break;
      case 'custom':
        validated = this.validateCustom(value, rule, field, errors);
        break;
    }

    // Apply transform if specified
    if (rule.transform && validated !== undefined) {
      validated = rule.transform(validated);
    }

    return validated;
  }

  /**
   * Validate string type
   */
  private validateString(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): string | undefined {
    if (typeof value !== 'string') {
      errors.push({
        field,
        message: `${field} must be a string`,
        value
      });
      return undefined;
    }

    // Length validation
    if (rule.min !== undefined && value.length < rule.min) {
      errors.push({
        field,
        message: `${field} must be at least ${rule.min} characters`,
        value
      });
    }

    if (rule.max !== undefined && value.length > rule.max) {
      errors.push({
        field,
        message: `${field} must not exceed ${rule.max} characters`,
        value
      });
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push({
        field,
        message: `${field} does not match required pattern`,
        value
      });
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({
        field,
        message: `${field} must be one of: ${rule.enum.join(', ')}`,
        value
      });
    }

    // Sanitize if requested
    if (rule.sanitize) {
      return this.sanitizeString(value);
    }

    return value;
  }

  /**
   * Validate number type
   */
  private validateNumber(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): number | undefined {
    const num = Number(value);
    
    if (isNaN(num)) {
      errors.push({
        field,
        message: `${field} must be a number`,
        value
      });
      return undefined;
    }

    // Range validation
    if (rule.min !== undefined && num < rule.min) {
      errors.push({
        field,
        message: `${field} must be at least ${rule.min}`,
        value
      });
    }

    if (rule.max !== undefined && num > rule.max) {
      errors.push({
        field,
        message: `${field} must not exceed ${rule.max}`,
        value
      });
    }

    return num;
  }

  /**
   * Validate boolean type
   */
  private validateBoolean(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 'true' || value === '1' || value === 1) {
      return true;
    }

    if (value === 'false' || value === '0' || value === 0) {
      return false;
    }

    errors.push({
      field,
      message: `${field} must be a boolean`,
      value
    });

    return undefined;
  }

  /**
   * Validate email
   */
  private validateEmail(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): string | undefined {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (typeof value !== 'string' || !emailPattern.test(value)) {
      errors.push({
        field,
        message: `${field} must be a valid email address`,
        value
      });
      return undefined;
    }

    return rule.sanitize ? this.sanitizeString(value) : value;
  }

  /**
   * Validate URL
   */
  private validateUrl(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): string | undefined {
    try {
      new URL(value);
      return rule.sanitize ? this.sanitizeString(value) : value;
    } catch {
      errors.push({
        field,
        message: `${field} must be a valid URL`,
        value
      });
      return undefined;
    }
  }

  /**
   * Validate date
   */
  private validateDate(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): Date | undefined {
    const date = new Date(value);
    
    if (isNaN(date.getTime())) {
      errors.push({
        field,
        message: `${field} must be a valid date`,
        value
      });
      return undefined;
    }

    return date;
  }

  /**
   * Validate array
   */
  private validateArray(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): any[] | undefined {
    if (!Array.isArray(value)) {
      errors.push({
        field,
        message: `${field} must be an array`,
        value
      });
      return undefined;
    }

    // Length validation
    if (rule.min !== undefined && value.length < rule.min) {
      errors.push({
        field,
        message: `${field} must have at least ${rule.min} items`,
        value
      });
    }

    if (rule.max !== undefined && value.length > rule.max) {
      errors.push({
        field,
        message: `${field} must not exceed ${rule.max} items`,
        value
      });
    }

    return value;
  }

  /**
   * Validate object type
   */
  private validateObjectType(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): object | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({
        field,
        message: `${field} must be an object`,
        value
      });
      return undefined;
    }

    return value;
  }

  /**
   * Validate with custom validator
   */
  private validateCustom(
    value: any,
    rule: ValidationRule,
    field: string,
    errors: ValidationError[]
  ): any {
    if (!rule.customValidator) {
      return value;
    }

    const result = rule.customValidator(value);
    
    if (typeof result === 'string') {
      errors.push({
        field,
        message: result,
        value
      });
      return undefined;
    }

    if (!result) {
      errors.push({
        field,
        message: `${field} failed custom validation`,
        value
      });
      return undefined;
    }

    return value;
  }

  /**
   * Sanitize string value
   */
  private sanitizeString(value: string): string {
    let sanitized = value;

    // Apply default sanitizers
    sanitized = this.sanitizers.get('trim')!(sanitized);
    sanitized = this.sanitizers.get('html')!(sanitized);
    sanitized = this.sanitizers.get('normalizeWhitespace')!(sanitized);

    return sanitized;
  }

  /**
   * Add custom sanitizer
   */
  public addSanitizer(name: string, sanitizer: (value: any) => any): void {
    this.sanitizers.set(name, sanitizer);
  }

  /**
   * Apply specific sanitizer
   */
  public sanitize(value: any, sanitizerName: string): any {
    const sanitizer = this.sanitizers.get(sanitizerName);
    if (!sanitizer) {
      logger.warn(`Sanitizer not found: ${sanitizerName}`);
      return value;
    }
    return sanitizer(value);
  }

  /**
   * Create validation middleware
   */
  public middleware(schema: ValidationSchema) {
    return (req: any, res: any, next: any) => {
      const result = this.validate(req.body, schema);

      if (!result.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: result.errors
        });
      }

      // Replace body with sanitized input
      req.body = result.sanitized;
      next();
    };
  }
}

// Common validation schemas
export const CommonSchemas = {
  // User registration
  userRegistration: {
    username: {
      type: 'string' as const,
      required: true,
      min: 3,
      max: 30,
      pattern: /^[a-zA-Z0-9_]+$/,
      sanitize: true
    },
    email: {
      type: 'email' as const,
      required: true,
      sanitize: true
    },
    password: {
      type: 'string' as const,
      required: true,
      min: 8,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
    }
  },

  // Login
  login: {
    email: {
      type: 'email' as const,
      required: true,
      sanitize: true
    },
    password: {
      type: 'string' as const,
      required: true
    }
  },

  // API request
  apiRequest: {
    endpoint: {
      type: 'string' as const,
      required: true,
      pattern: /^\/api\/[a-zA-Z0-9\/_-]+$/
    },
    method: {
      type: 'string' as const,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    params: {
      type: 'object' as const,
      required: false
    }
  }
};

// Export singleton instance
export const inputValidator = new InputValidator();