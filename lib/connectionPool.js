/**
 * SMTP Connection Pool Manager
 * Manages reusable SMTP connections similar to nodemailer's pooled transport
 */

import { EventEmitter } from 'events';
import { PoolError } from './errors.js';

export class SMTPConnectionPool extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            maxConnections: options.maxConnections || 5,
            maxMessages: options.maxMessages || 100,
            rateDelta: options.rateDelta || 1000,
            rateLimit: options.rateLimit || 3,
            idleTimeout: options.idleTimeout || 30000,
            ...options
        };

        this.connections = new Map();
        this.queue = [];
        this.activeConnections = 0;
        this.messagesSent = 0;
        this.lastRateCheck = Date.now();
        this.rateCounter = 0;
        this.closed = false;
    }

    /**
     * Get connection key for pooling
     */
    getConnectionKey(config) {
        return `${config.host}:${config.port}:${config.auth.user}`;
    }

    /**
     * Get or create a connection from the pool
     */
    async getConnection(config) {
        if (this.closed) {
            throw new PoolError('Connection pool is closed');
        }

        const key = this.getConnectionKey(config);

        // Check rate limiting
        await this.checkRateLimit();

        // Try to get existing idle connection
        const existingConnection = this.connections.get(key);
        if (existingConnection && existingConnection.isIdle() && !existingConnection.isExpired()) {
            existingConnection.markBusy();
            return existingConnection;
        }

        // Check if we can create new connection
        if (this.activeConnections >= this.options.maxConnections) {
            return new Promise((resolve, reject) => {
                this.queue.push({ config, resolve, reject, key });
            });
        }

        // Create new connection
        return this.createConnection(config, key);
    }

    /**
     * Create a new pooled connection
     */
    async createConnection(config, key) {
        const connection = new PooledSMTPConnection(config, this.options);

        connection.on('idle', () => {
            this.processQueue();
        });

        connection.on('close', () => {
            this.connections.delete(key);
            this.activeConnections--;
            this.processQueue();
        });

        try {
            await connection.connect();
            this.connections.set(key, connection);
            this.activeConnections++;
            return connection;
        } catch (error) {
            this.activeConnections--;
            throw error;
        }
    }

    /**
     * Process queued connection requests
     */
    processQueue() {
        if (this.queue.length === 0 || this.activeConnections >= this.options.maxConnections) {
            return;
        }

        const { config, resolve, reject, key } = this.queue.shift();

        this.createConnection(config, key)
            .then(resolve)
            .catch(reject);
    }

    /**
     * Check rate limiting
     */
    async checkRateLimit() {
        const now = Date.now();

        if (now - this.lastRateCheck >= this.options.rateDelta) {
            this.rateCounter = 0;
            this.lastRateCheck = now;
        }

        if (this.rateCounter >= this.options.rateLimit) {
            const waitTime = this.options.rateDelta - (now - this.lastRateCheck);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.checkRateLimit();
            }
        }

        this.rateCounter++;
    }

    /**
     * Release a connection back to the pool
     */
    releaseConnection(connection) {
        if (connection.messageCount >= this.options.maxMessages) {
            connection.close();
            return;
        }

        connection.markIdle();

        // Set idle timeout
        setTimeout(() => {
            if (connection.isIdle() && !connection.closed) {
                connection.close();
            }
        }, this.options.idleTimeout);
    }

    /**
     * Close all connections and clear the pool
     */
    async close() {
        this.closed = true;

        // Reject all queued requests
        this.queue.forEach(({ reject }) => {
            reject(new PoolError('Connection pool closed'));
        });
        this.queue = [];

        // Close all connections
        const closePromises = Array.from(this.connections.values()).map(conn => conn.close());
        await Promise.all(closePromises);

        this.connections.clear();
        this.activeConnections = 0;
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            activeConnections: this.activeConnections,
            idleConnections: Array.from(this.connections.values()).filter(c => c.isIdle()).length,
            queuedRequests: this.queue.length,
            messagesSent: this.messagesSent,
            maxConnections: this.options.maxConnections
        };
    }
}

/**
 * Pooled SMTP Connection wrapper
 */
class PooledSMTPConnection extends EventEmitter {
    constructor(config, poolOptions) {
        super();
        this.config = config;
        this.poolOptions = poolOptions;
        this.client = null;
        this.busy = false;
        this.messageCount = 0;
        this.createdAt = Date.now();
        this.lastUsed = Date.now();
        this.closed = false;
    }

    async connect() {
        // Import SMTPClient here to avoid circular dependency
        const { SMTPClient } = await import('./smtpClient.js');

        this.client = new SMTPClient(this.config);
        await this.client.connect();
        await this.client.readResponse();
        await this.client.authenticate();
    }

    async sendMail(mailOptions) {
        if (this.closed || !this.client) {
            throw new PoolError('Connection is closed');
        }

        this.lastUsed = Date.now();
        const messageId = await this.client.sendMail(mailOptions);
        this.messageCount++;

        return messageId;
    }

    markBusy() {
        this.busy = true;
    }

    markIdle() {
        this.busy = false;
        this.emit('idle');
    }

    isIdle() {
        return !this.busy && !this.closed;
    }

    isExpired() {
        return Date.now() - this.lastUsed > this.poolOptions.idleTimeout;
    }

    async close() {
        if (this.closed) return;

        this.closed = true;
        if (this.client) {
            await this.client.quit();
            this.client = null;
        }
        this.emit('close');
    }
}