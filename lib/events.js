/**
 * Senderwolf Event System
 * A singleton event emitter for email lifecycle hooks
 * 
 * Events:
 *   - 'sending'  : { to, subject, attempt, queueJobId, timestamp }
 *   - 'sent'     : { messageId, to, subject, elapsed, attempt, queueJobId, timestamp }
 *   - 'failed'   : { error, to, subject, attempt, willRetry, queueJobId, timestamp }
 *   - 'retrying'  : { to, subject, attempt, maxRetries, delay, error, queueJobId, timestamp }
 *   - 'queued'   : { to, subject, queueJobId, timestamp }
 */

import { EventEmitter } from 'node:events';

class SenderwolfEmitter extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
    }

    /**
     * Emit a 'sending' event before each send attempt
     */
    emitSending({ to, subject, attempt = 1, queueJobId }) {
        this.emit('sending', { to, subject, attempt, queueJobId, timestamp: Date.now() });
    }

    /**
     * Emit a 'sent' event after successful send
     */
    emitSent({ messageId, to, subject, elapsed, attempt = 1, queueJobId }) {
        this.emit('sent', { messageId, to, subject, elapsed, attempt, queueJobId, timestamp: Date.now() });
    }

    /**
     * Emit a 'failed' event after a failed attempt
     */
    emitFailed({ error, to, subject, attempt = 1, willRetry = false, queueJobId }) {
        this.emit('failed', { error, to, subject, attempt, willRetry, queueJobId, timestamp: Date.now() });
    }

    /**
     * Emit a 'retrying' event before a retry delay
     */
    emitRetrying({ to, subject, attempt, maxRetries, delay, error, queueJobId }) {
        this.emit('retrying', { to, subject, attempt, maxRetries, delay, error, queueJobId, timestamp: Date.now() });
    }

    /**
     * Emit a 'queued' event when an email is added to the persistence queue
     */
    emitQueued({ to, subject, queueJobId }) {
        this.emit('queued', { to, subject, queueJobId, timestamp: Date.now() });
    }
}

// Module-level singleton — shared across all sendEmail/createMailer calls
const senderwolfEvents = new SenderwolfEmitter();

/**
 * Subscribe to email lifecycle events
 */
export function on(event, listener) {
    return senderwolfEvents.on(event, listener);
}

/**
 * Unsubscribe from email lifecycle events
 */
export function off(event, listener) {
    return senderwolfEvents.off(event, listener);
}

/**
 * Subscribe to a single occurrence of an event
 */
export function once(event, listener) {
    return senderwolfEvents.once(event, listener);
}

/**
 * Remove all listeners for a specific event or all events
 */
export function removeAllListeners(event) {
    return senderwolfEvents.removeAllListeners(event);
}

export { senderwolfEvents };
