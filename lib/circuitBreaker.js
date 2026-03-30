/**
 * Simple Circuit Breaker Implementation for Senderwolf
 * Prevents hammering failing SMTP servers with requests
 */

export const CB_STATE = {
    CLOSED: 'CLOSED',       // Normal operation
    OPEN: 'OPEN',           // Failing fast
    HALF_OPEN: 'HALF_OPEN'  // Testing for recovery
};

export class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000; // 30s
        
        this.state = CB_STATE.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
    }

    /**
     * Check if the circuit allows a request
     * @returns {boolean} - True if open (fail fast), false if closed or half-open
     */
    isOpen() {
        if (this.state === CB_STATE.OPEN) {
            // Check if we can transition to half-open
            if (Date.now() > this.nextAttemptTime) {
                this.state = CB_STATE.HALF_OPEN;
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Record a successful operation
     */
    recordSuccess() {
        this.failureCount = 0;
        this.state = CB_STATE.CLOSED;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
    }

    /**
     * Record a failed operation
     */
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        // If we were half-open and failed, or exceeded threshold, open the circuit
        if (this.state === CB_STATE.HALF_OPEN || this.failureCount >= this.failureThreshold) {
            this.state = CB_STATE.OPEN;
            this.nextAttemptTime = Date.now() + this.resetTimeout;
        }
    }

    /**
     * Get current status description
     */
    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            nextAttemptAt: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null
        };
    }
}
