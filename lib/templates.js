/**
 * Minimal Email Templates System for Senderwolf
 */

import { TemplateError } from './errors.js';

// Template registry
const templates = new Map();

/**
 * Simple template engine
 */
class TemplateEngine {
    static compile(template, variables = {}) {
        if (!template || typeof template !== 'string') {
            throw new TemplateError('Template must be a non-empty string');
        }

        let compiled = template;

        // Handle conditional blocks: {{#if condition}}...{{/if}}
        compiled = compiled.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
            const value = this.getNestedValue(variables, condition);
            return this.isTruthy(value) ? this.compile(content, variables) : '';
        });

        // Handle unless blocks: {{#unless condition}}...{{/unless}}
        compiled = compiled.replace(/\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, condition, content) => {
            const value = this.getNestedValue(variables, condition);
            return !this.isTruthy(value) ? this.compile(content, variables) : '';
        });

        // Handle each blocks: {{#each array}}...{{/each}}
        compiled = compiled.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
            const array = this.getNestedValue(variables, arrayName);
            if (!Array.isArray(array)) return '';

            return array.map((item, index) => {
                const itemVars = {
                    ...variables,
                    this: item,
                    '@index': index,
                    '@first': index === 0,
                    '@last': index === array.length - 1
                };
                return this.compile(content, itemVars);
            }).join('');
        });

        // Handle simple variables: {{variable}}
        compiled = compiled.replace(/\{\{([^#\/][^}]*)\}\}/g, (match, variable) => {
            const trimmed = variable.trim();
            const value = this.getNestedValue(variables, trimmed);
            return value !== undefined && value !== null ? String(value) : '';
        });

        return compiled;
    }

    static getNestedValue(obj, path) {
        if (path === 'this') return obj.this;
        if (path.startsWith('@')) return obj[path];

        // Guard against prototype pollution (SEC-4)
        const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

        return path.split('.').reduce((current, key) => {
            if (BLOCKED_KEYS.has(key)) return undefined;
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    static isTruthy(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return Boolean(value);
    }

    static extractVariables(template) {
        const variables = new Set();
        const regex = /\{\{([^#\/][^}]*)\}\}/g;
        let match;

        while ((match = regex.exec(template)) !== null) {
            const variable = match[1].trim();
            if (!variable.startsWith('@')) {
                variables.add(variable);
            }
        }

        const blockRegex = /\{\{#(?:if|unless|each)\s+(\w+)\}\}/g;
        while ((match = blockRegex.exec(template)) !== null) {
            variables.add(match[1]);
        }

        return Array.from(variables);
    }
}

/**
 * Email Template class
 */
class EmailTemplate {
    constructor(name, config) {
        this.name = name;
        this.subject = config.subject || '';
        this.html = config.html || '';
        this.text = config.text || '';
        this.variables = config.variables || [];
        this.description = config.description || '';
        this.category = config.category || 'custom';
        this.created = config.created || new Date();
        this.updated = config.updated || new Date();

        if (this.variables.length === 0) {
            this.variables = this.extractAllVariables();
        }
    }

    extractAllVariables() {
        const allVariables = new Set();

        if (this.subject) {
            TemplateEngine.extractVariables(this.subject).forEach(v => allVariables.add(v));
        }
        if (this.html) {
            TemplateEngine.extractVariables(this.html).forEach(v => allVariables.add(v));
        }
        if (this.text) {
            TemplateEngine.extractVariables(this.text).forEach(v => allVariables.add(v));
        }

        return Array.from(allVariables);
    }

    render(variables = {}) {
        return {
            subject: this.subject ? TemplateEngine.compile(this.subject, variables) : '',
            html: this.html ? TemplateEngine.compile(this.html, variables) : '',
            text: this.text ? TemplateEngine.compile(this.text, variables) : '',
        };
    }

    validate() {
        const errors = [];

        try {
            if (this.subject) TemplateEngine.compile(this.subject, {});
        } catch (error) {
            errors.push(`Subject template error: ${error.message}`);
        }

        try {
            if (this.html) TemplateEngine.compile(this.html, {});
        } catch (error) {
            errors.push(`HTML template error: ${error.message}`);
        }

        try {
            if (this.text) TemplateEngine.compile(this.text, {});
        } catch (error) {
            errors.push(`Text template error: ${error.message}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    toJSON() {
        return {
            name: this.name,
            subject: this.subject,
            html: this.html,
            text: this.text,
            variables: this.variables,
            description: this.description,
            category: this.category,
            created: this.created,
            updated: this.updated
        };
    }

    static fromJSON(data) {
        return new EmailTemplate(data.name, data);
    }
}

/**
 * Template Manager
 */
class TemplateManager {
    static registerTemplate(name, config) {
        if (!name || typeof name !== 'string') {
            throw new TemplateError('Template name must be a non-empty string');
        }

        if (!config || typeof config !== 'object') {
            throw new TemplateError('Template config must be an object');
        }

        if (!config.subject && !config.html && !config.text) {
            throw new TemplateError('Template must have at least subject, html, or text content');
        }

        const template = new EmailTemplate(name, config);
        const validation = template.validate();

        if (!validation.valid) {
            throw new TemplateError(`Template validation failed: ${validation.errors.join(', ')}`);
        }

        templates.set(name, template);
        return template;
    }

    static getTemplate(name) {
        return templates.get(name) || null;
    }

    static hasTemplate(name) {
        return templates.has(name);
    }

    static listTemplates(category = null) {
        const allTemplates = Array.from(templates.values());

        if (category) {
            return allTemplates.filter(template => template.category === category);
        }

        return allTemplates;
    }

    static getCategories() {
        const categories = new Set();
        templates.forEach(template => categories.add(template.category));
        return Array.from(categories);
    }

    static removeTemplate(name) {
        return templates.delete(name);
    }

    static updateTemplate(name, config) {
        if (!templates.has(name)) {
            throw new TemplateError(`Template '${name}' does not exist`);
        }

        const existingTemplate = templates.get(name);
        const updatedConfig = {
            ...existingTemplate.toJSON(),
            ...config,
            updated: new Date()
        };

        return this.registerTemplate(name, updatedConfig);
    }

    static clearAll() {
        templates.clear();
    }
}

// Built-in templates with proper syntax
const BUILTIN_TEMPLATES = {
    welcome: {
        name: 'welcome',
        subject: 'Welcome to {{appName}}!',
        html: '<div style="font-family: Arial, sans-serif;"><h1>Welcome to {{appName}}!</h1><p>Hi {{userName}},</p><p>Thank you for joining {{appName}}.</p>{{#if verificationRequired}}<p><a href="{{verificationUrl}}">Verify Email</a></p>{{/if}}<p>Best regards,<br>The {{appName}} Team</p></div>',
        text: 'Welcome to {{appName}}!\n\nHi {{userName}},\n\nThank you for joining {{appName}}.\n\n{{#if verificationRequired}}Please verify: {{verificationUrl}}{{/if}}\n\nBest regards,\nThe {{appName}} Team',
        description: 'Welcome email for new users',
        category: 'authentication',
        variables: ['appName', 'userName', 'verificationRequired', 'verificationUrl']
    },

    passwordReset: {
        name: 'passwordReset',
        subject: 'Reset your {{appName}} password',
        html: '<div style="font-family: Arial, sans-serif;"><h1>Password Reset</h1><p>Hi {{userName}},</p><p>Reset your password: <a href="{{resetUrl}}">Reset Password</a></p><p>Expires in {{expirationTime}} minutes.</p></div>',
        text: 'Password Reset\n\nHi {{userName}},\n\nReset your password: {{resetUrl}}\n\nExpires in {{expirationTime}} minutes.',
        description: 'Password reset email',
        category: 'authentication',
        variables: ['appName', 'userName', 'resetUrl', 'expirationTime']
    },

    notification: {
        name: 'notification',
        subject: '{{title}}',
        html: '<div style="font-family: Arial, sans-serif;"><h1>{{title}}</h1><p>Hi {{userName}},</p><div>{{message}}</div>{{#if actionRequired}}<p><a href="{{actionUrl}}">{{actionText}}</a></p>{{/if}}<p>Best regards,<br>{{senderName}}</p></div>',
        text: '{{title}}\n\nHi {{userName}},\n\n{{message}}\n\n{{#if actionRequired}}{{actionText}}: {{actionUrl}}{{/if}}\n\nBest regards,\n{{senderName}}',
        description: 'General notification email',
        category: 'notification',
        variables: ['title', 'userName', 'message', 'actionRequired', 'actionUrl', 'actionText', 'senderName']
    },

    invoice: {
        name: 'invoice',
        subject: 'Invoice #{{invoiceNumber}} from {{companyName}}',
        html: '<div style="font-family: Arial, sans-serif;"><h1>{{companyName}}</h1><p>Invoice #{{invoiceNumber}}</p><h3>Bill To:</h3><p>{{customerName}}<br>{{customerEmail}}</p><h3>Items:</h3><ul>{{#each items}}<li>{{this.description}}: ${{this.amount}}</li>{{/each}}</ul><p><strong>Total: ${{totalAmount}}</strong></p><p>Due: {{dueDate}}</p></div>',
        text: 'Invoice #{{invoiceNumber}} from {{companyName}}\n\nBill To:\n{{customerName}}\n{{customerEmail}}\n\nItems:\n{{#each items}}- {{this.description}}: ${{this.amount}}\n{{/each}}\nTotal: ${{totalAmount}}\nDue: {{dueDate}}',
        description: 'Invoice email template',
        category: 'business',
        variables: ['invoiceNumber', 'companyName', 'customerName', 'customerEmail', 'items', 'totalAmount', 'dueDate']
    }
};

// Initialize built-in templates
function initializeBuiltinTemplates() {
    Object.values(BUILTIN_TEMPLATES).forEach(template => {
        TemplateManager.registerTemplate(template.name, template);
    });
}

// Initialize on module load
initializeBuiltinTemplates();

export {
    TemplateEngine,
    EmailTemplate,
    TemplateManager,
    BUILTIN_TEMPLATES
};