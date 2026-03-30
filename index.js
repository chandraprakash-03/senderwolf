// Main email sending function
export { sendEmail, closeAllPools, getPoolStats, coreSend } from './lib/sendEmail.js';

// Simple API for easier usage
export {
    createMailer,
    quickSend,
    sendGmail,
    sendOutlook,
    testConnection,
    listProviders,
    registerTemplate,
    getTemplate,
    listTemplates,
    removeTemplate,
    previewTemplate,
    loadTemplateFromFile,
    saveTemplateToFile,
    loadTemplatesFromDirectory
} from './lib/simple.js';

// Provider utilities
export {
    getProviderConfig,
    detectProvider,
    registerProvider,
    unregisterProvider,
    registerDomain,
    hasProvider,
    suggestSMTPSettings,
    getAllProviders,
    SMTP_PROVIDERS
} from './lib/providers.js';

// Configuration utilities
export { loadConfig } from './lib/config.js';

// Template system
export {
    TemplateEngine,
    EmailTemplate,
    TemplateManager,
    BUILTIN_TEMPLATES
} from './lib/templates.js';

// Event system
export {
    on,
    off,
    once,
    removeAllListeners,
    senderwolfEvents
} from './lib/events.js';

// Retry utilities
export { withRetry, DEFAULT_RETRY_OPTIONS } from './lib/retry.js';

// HTML to plain text utility
export { htmlToText } from './lib/htmlToText.js';

// DKIM signing utilities
export { signMessage, validateDKIMConfig } from './lib/dkim.js';

// ICS / Calendar utilities
export { generateICS, validateCalendarEvent, formatICSDate } from './lib/ics.js';

// Queue Interface
export { QueueStore } from './lib/queueStore.js';

// Custom error classes
export {
    SenderwolfError,
    ConnectionError,
    AuthenticationError,
    SMTPError,
    ValidationError,
    TemplateError,
    ProviderError,
    PoolError,
    AttachmentError
} from './lib/errors.js';
