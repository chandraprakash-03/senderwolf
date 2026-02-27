/**
 * Built-in SMTP provider configurations
 * Makes it easy to use popular email providers without manual configuration
 */

import { ProviderError } from './errors.js';

export const SMTP_PROVIDERS = {
    // Gmail
    gmail: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        requireTLS: false,
        name: "Gmail SMTP",
    },

    // Outlook/Hotmail/Live
    outlook: {
        host: "smtp-mail.outlook.com",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "Outlook SMTP",
    },

    // Yahoo
    yahoo: {
        host: "smtp.mail.yahoo.com",
        port: 465,
        secure: true,
        requireTLS: false,
        name: "Yahoo SMTP",
    },

    // Zoho
    zoho: {
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        requireTLS: false,
        name: "Zoho SMTP",
    },

    // Amazon SES
    ses: {
        host: "email-smtp.us-east-1.amazonaws.com",
        port: 465,
        secure: true,
        requireTLS: false,
        name: "Amazon SES",
    },

    // SendGrid
    sendgrid: {
        host: "smtp.sendgrid.net",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "SendGrid SMTP",
    },

    // Mailgun
    mailgun: {
        host: "smtp.mailgun.org",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "Mailgun SMTP",
    },

    // Mailtrap (testing)
    mailtrap: {
        host: "smtp.mailtrap.io",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "Mailtrap SMTP",
    },

    // Postmark
    postmark: {
        host: "smtp.postmarkapp.com",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "Postmark SMTP",
    },

    // Mailjet
    mailjet: {
        host: "in-v3.mailjet.com",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "Mailjet SMTP",
    },

    // Resend (new provider example)
    resend: {
        host: "smtp.resend.com",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "Resend SMTP",
    },

    // Brevo (formerly Sendinblue)
    brevo: {
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "Brevo SMTP",
    },

    // ConvertKit
    convertkit: {
        host: "smtp.convertkit.com",
        port: 587,
        secure: false,
        requireTLS: true,
        name: "ConvertKit SMTP",
    },
};

// Domain to provider mapping (can be extended)
const DOMAIN_MAP = {
    'gmail.com': 'gmail',
    'googlemail.com': 'gmail',
    'outlook.com': 'outlook',
    'hotmail.com': 'outlook',
    'live.com': 'outlook',
    'msn.com': 'outlook',
    'yahoo.com': 'yahoo',
    'yahoo.co.uk': 'yahoo',
    'yahoo.ca': 'yahoo',
    'zoho.com': 'zoho',
    'zohomail.com': 'zoho',
};

/**
 * Register a domain mapping to a provider
 */
export function registerDomain(domain, provider) {
    DOMAIN_MAP[domain.toLowerCase()] = provider.toLowerCase();
}

/**
 * Auto-detect provider based on email domain
 */
export function detectProvider(email) {
    if (!email || typeof email !== 'string') return null;

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return null;

    return DOMAIN_MAP[domain] || null;
}

/**
 * Suggest SMTP settings for unknown domains using common patterns
 */
export function suggestSMTPSettings(domain) {
    if (!domain) return null;

    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    // Common SMTP hostname patterns
    const patterns = [
        `smtp.${cleanDomain}`,
        `mail.${cleanDomain}`,
        `smtp.mail.${cleanDomain}`,
        `outgoing.${cleanDomain}`,
    ];

    return {
        suggestions: patterns,
        commonPorts: [587, 465, 25, 2525],
        note: 'These are common patterns. Check your email provider\'s documentation for exact settings.'
    };
}

/**
 * Get provider configuration by name or auto-detect from email
 */
export function getProviderConfig(providerOrEmail) {
    if (!providerOrEmail) return null;

    // If it's a known provider name
    if (SMTP_PROVIDERS[providerOrEmail]) {
        return { ...SMTP_PROVIDERS[providerOrEmail] };
    }

    // Try to detect from email
    const detected = detectProvider(providerOrEmail);
    if (detected && SMTP_PROVIDERS[detected]) {
        return { ...SMTP_PROVIDERS[detected] };
    }

    return null;
}

/**
 * Register a new SMTP provider
 */
export function registerProvider(name, config) {
    if (!name || !config) {
        throw new ProviderError('Provider name and config are required');
    }

    if (!config.host) {
        throw new ProviderError('Provider config must include host');
    }

    const providerConfig = {
        host: config.host,
        port: config.port || 587,
        secure: config.secure ?? false,
        requireTLS: config.requireTLS ?? true,
        name: config.name || `${name} SMTP`,
        ...config
    };

    SMTP_PROVIDERS[name.toLowerCase()] = providerConfig;
    return providerConfig;
}

/**
 * Remove a provider
 */
export function unregisterProvider(name) {
    delete SMTP_PROVIDERS[name.toLowerCase()];
}

/**
 * Check if a provider exists
 */
export function hasProvider(name) {
    return name.toLowerCase() in SMTP_PROVIDERS;
}

/**
 * List all available providers
 */
export function listProviders() {
    return Object.keys(SMTP_PROVIDERS).map(key => ({
        name: key,
        displayName: SMTP_PROVIDERS[key].name,
        host: SMTP_PROVIDERS[key].host,
        port: SMTP_PROVIDERS[key].port,
        secure: SMTP_PROVIDERS[key].secure,
    }));
}

/**
 * Get all provider configurations (for debugging/inspection)
 */
export function getAllProviders() {
    return { ...SMTP_PROVIDERS };
}