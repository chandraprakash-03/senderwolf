/**
 * Custom error classes for Senderwolf
 * Provides granular error handling for SMTP, auth, connection, template, and pool errors
 */

/**
 * Base error class for all Senderwolf errors
 */
export class SenderwolfError extends Error {
    constructor(message, code = 'ERR_SENDERWOLF') {
        super(message);
        this.name = 'SenderwolfError';
        this.code = code;
    }
}

/**
 * Connection-related errors (timeouts, socket failures, TLS issues)
 */
export class ConnectionError extends SenderwolfError {
    constructor(message) {
        super(message, 'ERR_SMTP_CONNECTION');
        this.name = 'ConnectionError';
    }
}

/**
 * Authentication errors (wrong credentials, unsupported auth method)
 */
export class AuthenticationError extends SenderwolfError {
    constructor(message) {
        super(message, 'ERR_SMTP_AUTH');
        this.name = 'AuthenticationError';
    }
}

/**
 * SMTP protocol-level errors (command rejections, send failures)
 */
export class SMTPError extends SenderwolfError {
    /**
     * @param {string} message - Error message
     * @param {string} [smtpResponse] - Raw SMTP response string
     * @param {number} [responseCode] - SMTP response code (e.g. 550)
     */
    constructor(message, smtpResponse, responseCode) {
        super(message, 'ERR_SMTP_PROTOCOL');
        this.name = 'SMTPError';
        this.smtpResponse = smtpResponse || null;
        this.responseCode = responseCode || null;
    }
}

/**
 * Validation errors (schema validation failures)
 */
export class ValidationError extends SenderwolfError {
    /**
     * @param {string} message - Error message
     * @param {Array} [errors] - Array of individual validation error details
     */
    constructor(message, errors) {
        super(message, 'ERR_VALIDATION');
        this.name = 'ValidationError';
        this.errors = errors || [];
    }
}

/**
 * Template-related errors (missing templates, invalid template config)
 */
export class TemplateError extends SenderwolfError {
    constructor(message) {
        super(message, 'ERR_TEMPLATE');
        this.name = 'TemplateError';
    }
}

/**
 * Provider-related errors (missing/invalid provider config)
 */
export class ProviderError extends SenderwolfError {
    constructor(message) {
        super(message, 'ERR_PROVIDER');
        this.name = 'ProviderError';
    }
}

/**
 * Connection pool errors (pool closed, connection expired)
 */
export class PoolError extends SenderwolfError {
    constructor(message) {
        super(message, 'ERR_POOL');
        this.name = 'PoolError';
    }
}

/**
 * Attachment-related errors (unsupported attachment type, missing content)
 */
export class AttachmentError extends SenderwolfError {
    constructor(message) {
        super(message, 'ERR_ATTACHMENT');
        this.name = 'AttachmentError';
    }
}
