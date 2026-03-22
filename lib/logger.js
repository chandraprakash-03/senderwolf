/**
 * Simple pluggable logger for senderwolf
 */
class Logger {
    constructor(logger = console) {
        this.setLogger(logger);
    }

    /**
     * Set a custom logger instance (e.g., Winston, Pino, or a custom object)
     * Must implement: info, warn, error, debug
     */
    setLogger(logger) {
        this.instance = logger;
    }

    info(...args) {
        if (typeof this.instance.info === 'function') {
            this.instance.info(...args);
        } else if (typeof this.instance.log === 'function') {
            this.instance.log(...args);
        }
    }

    warn(...args) {
        if (typeof this.instance.warn === 'function') {
            this.instance.warn(...args);
        } else {
            this.info('[WARN]', ...args);
        }
    }

    error(...args) {
        if (typeof this.instance.error === 'function') {
            this.instance.error(...args);
        } else {
            this.info('[ERROR]', ...args);
        }
    }

    debug(...args) {
        if (typeof this.instance.debug === 'function') {
            this.instance.debug(...args);
        } else if (process.env.DEBUG || this.instance.isDebug) {
            this.info('[DEBUG]', ...args);
        }
    }
}

// Global singleton instance
export const logger = new Logger();

export default logger;
