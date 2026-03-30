/**
 * Abstract interface for Queue Storage backends.
 * Any queue plugin (like @senderwolf/plugin-queue-local) should extend this.
 */
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
        throw new Error("Method 'enqueue()' must be implemented by the QueueStore plugin.");
    }

    /**
     * Start the worker daemon to process jobs
     */
    async startWorker() {
        throw new Error("Method 'startWorker()' must be implemented by the QueueStore plugin.");
    }

    /**
     * Stop the worker gracefully
     */
    async stopWorker() {
        throw new Error("Method 'stopWorker()' must be implemented by the QueueStore plugin.");
    }
}
