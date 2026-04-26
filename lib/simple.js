/**
 * Simple API wrapper for senderwolf - even easier than nodemailer
 * Provides convenience methods for common use cases
 */

import { sendEmail } from './sendEmail.js';
import { listProviders } from './providers.js';
import { TemplateManager } from './templates.js';
import { senderwolfEvents } from './events.js';
import { TemplateError } from './errors.js';

/**
 * Create a reusable mailer instance with preset configuration
 * Automatically enables connection pooling for better performance
 */
export function createMailer(config = {}) {
    const defaultConfig = {
        smtp: {
            usePool: true, // Enable pooling by default for mailer instances
            ...config.smtp
        },
        defaults: config.defaults || {},
        retry: config.retry || {},
    };

    return {
        /**
         * Send a simple email
         */
        async send(options) {
            const merged = {
                smtp: { ...defaultConfig.smtp, ...options.smtp },
                mail: { ...defaultConfig.defaults, ...options },
                retry: options.retry || defaultConfig.retry,
            };
            return sendEmail(merged);
        },

        /**
         * Send HTML email
         */
        async sendHtml(to, subject, html, options = {}) {
            return this.send({ to, subject, html, ...options });
        },

        /**
         * Send text email
         */
        async sendText(to, subject, text, options = {}) {
            return this.send({ to, subject, text, ...options });
        },

        /**
         * Send A/B testing email with multiple subject lines
         */
        async sendAB(to, subjects, content, options = {}) {
            const mailOptions = {
                to,
                subjects,
                ...options,
            };

            if (typeof content === 'string' && content.includes('<')) {
                mailOptions.html = content;
            } else {
                mailOptions.text = content;
            }

            return this.send(mailOptions);
        },

        /**
         * Send email with attachments
         */
        async sendWithAttachments(to, subject, content, attachments, options = {}) {
            const mailOptions = {
                to,
                subject,
                attachments,
                ...options,
            };

            if (typeof content === 'string' && content.includes('<')) {
                mailOptions.html = content;
            } else {
                mailOptions.text = content;
            }

            return this.send(mailOptions);
        },

        /**
         * Send email using a template
         */
        async sendTemplate(templateName, to, variables = {}, options = {}) {
            const template = TemplateManager.getTemplate(templateName);
            if (!template) {
                throw new TemplateError(`Template '${templateName}' not found`);
            }

            const rendered = template.render(variables);

            return this.send({
                to,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
                ...options
            });
        },

        /**
         * Send bulk emails using a template
         */
        async sendBulkTemplate(templateName, recipients, variables = {}, options = {}) {
            const template = TemplateManager.getTemplate(templateName);
            if (!template) {
                throw new TemplateError(`Template '${templateName}' not found`);
            }

            const results = [];

            // Use Promise.allSettled for concurrent sending with pooling
            const promises = recipients.map(async (recipient) => {
                try {
                    // Allow per-recipient variables
                    const recipientVars = typeof variables === 'function'
                        ? variables(recipient)
                        : { ...variables, recipient };

                    const rendered = template.render(recipientVars);

                    const result = await this.send({
                        to: recipient,
                        subject: rendered.subject,
                        html: rendered.html,
                        text: rendered.text,
                        ...options,
                    });
                    return { recipient, success: true, messageId: result.messageId };
                } catch (error) {
                    return { recipient, success: false, error: error.message };
                }
            });

            const settled = await Promise.allSettled(promises);
            return settled.map(result => result.status === 'fulfilled' ? result.value : result.reason);
        },

        /**
         * Preview a template with variables (without sending)
         */
        previewTemplate(templateName, variables = {}) {
            const template = TemplateManager.getTemplate(templateName);
            if (!template) {
                throw new TemplateError(`Template '${templateName}' not found`);
            }

            return template.render(variables);
        },
        async sendBulk(recipients, subject, content, options = {}) {
            const results = [];

            // Use Promise.allSettled for concurrent sending with pooling
            const promises = recipients.map(async (recipient) => {
                try {
                    const result = await this.send({
                        to: recipient,
                        subject,
                        ...(typeof content === 'string' && content.includes('<')
                            ? { html: content }
                            : { text: content }),
                        ...options,
                    });
                    return { recipient, success: true, messageId: result.messageId };
                } catch (error) {
                    return { recipient, success: false, error: error.message };
                }
            });

            const settled = await Promise.allSettled(promises);
            return settled.map(result => result.status === 'fulfilled' ? result.value : result.reason);
        },

        /**
         * Close the connection pool for this mailer
         */
        async close() {
            const { closeAllPools } = await import('./sendEmail.js');
            await closeAllPools();
        },

        /**
         * Get connection pool statistics
         */
        async getStats() {
            const { getPoolStats } = await import('./sendEmail.js');
            return getPoolStats();
        },

        /**
         * Subscribe to email lifecycle events
         */
        on(event, listener) {
            senderwolfEvents.on(event, listener);
            return this;
        },

        /**
         * Unsubscribe from email lifecycle events
         */
        off(event, listener) {
            senderwolfEvents.off(event, listener);
            return this;
        },

        /**
         * Subscribe to a single occurrence of an event
         */
        once(event, listener) {
            senderwolfEvents.once(event, listener);
            return this;
        },
    };
}

/**
 * Quick send functions for one-off emails
 */
export async function quickSend(provider, user, pass, to, subject, content, options = {}) {
    const config = {
        smtp: {
            provider,
            auth: { user, pass },
        },
        mail: {
            to,
            subject,
            ...(typeof content === 'string' && content.includes('<')
                ? { html: content }
                : { text: content }),
            ...options,
        },
    };

    return sendEmail(config);
}

/**
 * Gmail shortcut
 */
export async function sendGmail(user, pass, to, subject, content, options = {}) {
    return quickSend('gmail', user, pass, to, subject, content, options);
}

/**
 * Outlook shortcut
 */
export async function sendOutlook(user, pass, to, subject, content, options = {}) {
    return quickSend('outlook', user, pass, to, subject, content, options);
}

/**
 * Test email connectivity
 */
export async function testConnection(config) {
    try {
        const result = await sendEmail({
            ...config,
            mail: {
                to: config.smtp?.auth?.user || config.mail?.to,
                subject: 'Senderwolf Connection Test',
                text: 'This is a test email to verify SMTP connectivity.',
                ...config.mail,
            },
        });

        return {
            success: true,
            message: 'Connection successful',
            messageId: result.messageId,
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            error: error,
        };
    }
}

/**
 * Get available providers
 */
export { listProviders };

/**
 * Template management functions
 */
export function registerTemplate(name, config) {
    return TemplateManager.registerTemplate(name, config);
}

export function getTemplate(name) {
    return TemplateManager.getTemplate(name);
}

export function listTemplates(category = null) {
    return TemplateManager.listTemplates(category);
}

export function removeTemplate(name) {
    return TemplateManager.removeTemplate(name);
}

export function previewTemplate(templateName, variables = {}) {
    const template = TemplateManager.getTemplate(templateName);
    if (!template) {
        throw new TemplateError(`Template '${templateName}' not found`);
    }
    return template.render(variables);
}

export async function loadTemplateFromFile(filePath) {
    return TemplateManager.loadFromFile(filePath);
}

export async function saveTemplateToFile(name, filePath) {
    return TemplateManager.saveToFile(name, filePath);
}

export async function loadTemplatesFromDirectory(dirPath) {
    return TemplateManager.loadFromDirectory(dirPath);
}

/**
 * Export main function for backward compatibility
 */
export { sendEmail };