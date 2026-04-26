/**
 * Abstract interface for Queue Storage backends.
 * Any queue plugin (like @senderwolf/plugin-queue-local) should extend this.
 */
import { SenderwolfError } from './errors.js';

export class QueueStore {
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * Enqueue a new email job
     * @param {Object} payload - The job payload containing smtp, mailOptions, retryOptions, etc.
     * @returns {Promise<string|number>} - The unique job ID
     */
    async enqueue(payload) {
        throw new SenderwolfError("Method 'enqueue()' must be implemented by the QueueStore plugin.", 'ERR_QUEUE_NOT_IMPLEMENTED');
    }

    /**
     * Start the worker daemon to process jobs
     */
    async startWorker() {
        throw new SenderwolfError("Method 'startWorker()' must be implemented by the QueueStore plugin.", 'ERR_QUEUE_NOT_IMPLEMENTED');
    }

    /**
     * Stop the worker gracefully
     */
    async stopWorker() {
        throw new SenderwolfError("Method 'stopWorker()' must be implemented by the QueueStore plugin.", 'ERR_QUEUE_NOT_IMPLEMENTED');
    }
}
