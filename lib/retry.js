/**
 * Senderwolf Retry Logic with Exponential Backoff
 * 
 * Wraps async functions with configurable retry behavior.
 * Only retries on transient/network errors by default.
 */

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS = {
    maxRetries: 0,           // Disabled by default (backward compatible)
    initialDelay: 1000,      // 1 second
    backoffMultiplier: 2,    // Double the delay each retry
    maxDelay: 30000,         // Cap at 30 seconds
    retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'EPIPE',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'EAI_AGAIN',        // DNS lookup timeout
    ],
};

/**
 * Error codes/messages that should NEVER be retried
 */
const NON_RETRYABLE_PATTERNS = [
    'authentication',
    'auth failed',
    'invalid login',
    'invalid credentials',
    'bad credentials',
    'username and password not accepted',
    'invalid mailbox',
    'mailbox not found',
    'relay access denied',
    'sender verify failed',
];

/**
 * Determine if an error is retryable
 */
function isRetryable(error, options) {
    // Custom shouldRetry takes priority
    if (typeof options.shouldRetry === 'function') {
        return options.shouldRetry(error);
    }

    const errorMessage = (error.message || '').toLowerCase();
    const errorCode = error.code || '';

    // Never retry auth/permanent errors
    for (const pattern of NON_RETRYABLE_PATTERNS) {
        if (errorMessage.includes(pattern)) {
            return false;
        }
    }

    // SMTP 5xx errors are permanent — never retry
    if (errorMessage.match(/^5\d{2}\s/) || errorMessage.includes('smtp error: 5')) {
        return false;
    }

    // Check if error code matches retryable list
    const retryableErrors = options.retryableErrors || DEFAULT_RETRY_OPTIONS.retryableErrors;
    if (errorCode && retryableErrors.includes(errorCode)) {
        return true;
    }

    // Check for common transient error messages
    const transientPatterns = [
        'connection timeout',
        'socket timeout',
        'connection reset',
        'connection refused',
        'broken pipe',
        'network',
        'dns',
        'econnreset',
        'etimedout',
        'econnrefused',
        'too many connections',
        'rate limit',
        'temporary',
        'try again',
        'service unavailable',
    ];

    for (const pattern of transientPatterns) {
        if (errorMessage.includes(pattern)) {
            return true;
        }
    }

    // SMTP 4xx errors are temporary — retry
    if (errorMessage.match(/^4\d{2}\s/) || errorMessage.includes('smtp error: 4')) {
        return true;
    }

    return false;
}

/**
 * Calculate delay for the next retry with exponential backoff + jitter
 */
function calculateDelay(attempt, options) {
    const baseDelay = options.initialDelay || DEFAULT_RETRY_OPTIONS.initialDelay;
    const multiplier = options.backoffMultiplier || DEFAULT_RETRY_OPTIONS.backoffMultiplier;
    const maxDelay = options.maxDelay || DEFAULT_RETRY_OPTIONS.maxDelay;

    // Exponential backoff: initialDelay * multiplier^(attempt-1)
    const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);

    // Add jitter (±20%) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.round(exponentialDelay + jitter);

    return Math.min(delay, maxDelay);
}

/**
 * Wrap an async function with retry logic
 * 
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Retry configuration
 * @param {Object} callbacks - Optional lifecycle callbacks { onRetry }
 * @returns {Promise<{ result: any, attempts: number }>}
 */
export async function withRetry(fn, options = {}, callbacks = {}) {
    const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const result = await fn(attempt);
            return { result, attempts: attempt };
        } catch (error) {
            lastError = error;

            // Check if we've exhausted retries
            if (attempt > maxRetries) {
                break;
            }

            // Check if error is retryable
            if (!isRetryable(error, options)) {
                break;
            }

            // Calculate delay
            const delay = calculateDelay(attempt, options);

            // Notify about retry
            if (typeof callbacks.onRetry === 'function') {
                callbacks.onRetry({
                    attempt,
                    maxRetries,
                    delay,
                    error: error.message || String(error),
                });
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // All retries exhausted
    throw lastError;
}
