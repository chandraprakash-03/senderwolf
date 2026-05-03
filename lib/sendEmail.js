import * as os from "node:os";
import * as path from "node:path";
import { validateInput } from "./schema.js";
import { loadConfig } from "./config.js";
import { getProviderConfig, detectProvider } from "./providers.js";
import { SMTPClient } from "./smtpClient.js";
import { SMTPConnectionPool } from "./connectionPool.js";
import { withRetry } from "./retry.js";
import { senderwolfEvents } from "./events.js";
import { htmlToText } from "./htmlToText.js";
import { logger } from "./logger.js";
import { generateICS } from "./ics.js";
import { captureEmail } from "./devServer.js";
import { inlineCSS, minifyHTML } from "./htmlUtils.js";
import { CircuitBreaker } from "./circuitBreaker.js";
import { validateRecipientsMX } from "./validator.js";

// Global connection pools for different SMTP configurations
const connectionPools = new Map();
// Global circuit breakers per pool key
const circuitBreakers = new Map();

/**
 * Get or create a circuit breaker for a pool
 */
function getCircuitBreaker(poolKey) {
    if (!circuitBreakers.has(poolKey)) {
        circuitBreakers.set(poolKey, new CircuitBreaker());
    }
    return circuitBreakers.get(poolKey);
}

/**
 * Parse human readable intervals (e.g. "5m", "1h") into milliseconds
 */
function parseInterval(interval) {
    if (typeof interval === 'number') return interval;
    if (typeof interval !== 'string') return 0;

    // Try shorthand format first (e.g. "5m", "1h", "30s", "2d")
    const match = interval.match(/^(\d+)([smhd])$/);
    if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 0;
        }
    }

    // Try parsing as ISO 8601 date string (e.g. "2026-05-01T10:00:00Z")
    const parsed = new Date(interval);
    if (!isNaN(parsed.getTime())) {
        return Math.max(0, parsed.getTime() - Date.now());
    }

    return 0;
}

/**
 * Get or create a connection pool for the given SMTP configuration
 */
function getConnectionPool(smtpConfig) {
    const poolKey = `${smtpConfig.host}:${smtpConfig.port}:${smtpConfig.auth?.user ?? ''}`;

    if (!connectionPools.has(poolKey)) {
        const pool = new SMTPConnectionPool({
            maxConnections: smtpConfig.pool?.maxConnections || 5,
            maxMessages: smtpConfig.pool?.maxMessages || 100,
            rateDelta: smtpConfig.pool?.rateDelta || 1000,
            rateLimit: smtpConfig.pool?.rateLimit || 3,
            idleTimeout: smtpConfig.pool?.idleTimeout || 30000,
        });
        connectionPools.set(poolKey, pool);
    }

    return connectionPools.get(poolKey);
}

/**
 * Core send logic — extracted so it can be wrapped with retry
 */
export async function coreSend(smtp, mailOptions) {
    if (smtp.dev) {
        return await captureEmail(mailOptions);
    }
    let connection = null;
    let pool = null;
    const poolKey = `${smtp.host}:${smtp.port}:${smtp.auth?.user ?? ''}`;
    const cb = getCircuitBreaker(poolKey);

    if (cb.isOpen()) {
        const error = new Error(`Circuit breaker for ${smtp.host} is OPEN. Failing fast.`);
        error.name = 'CircuitBreakerError';
        throw error;
    }

    try {
        let messageId;

        if (smtp.usePool) {
            // Use connection pooling
            pool = getConnectionPool(smtp);
            connection = await pool.getConnection(smtp);
            messageId = await connection.sendMail(mailOptions);
            pool.releaseConnection(connection);
        } else {
            // Use direct connection (legacy behavior)
            const client = new SMTPClient(smtp);
            await client.connect();
            await client.readResponse();
            await client.authenticate();
            messageId = await client.sendMail(mailOptions);
            await client.quit();
        }

        cb.recordSuccess();
        return messageId;
    } catch (error) {
        cb.recordFailure();
        if (connection && pool) {
            // Destroy broken connections instead of re-queuing them (C1 fix)
            connection.close();
        }
        throw error;
    }
}

/**
 * Sends an email using any SMTP provider with enhanced features.
 * Supports multiple auth methods, CC/BCC, attachments, provider auto-detection,
 * connection pooling, retry with exponential backoff, and lifecycle events.
 *
 * @param {Object} input - The input config containing smtp, mail, and optional retry data.
 * @returns {Promise<Object>} - Result with success status, messageId, attempts, or error.
 */
export async function sendEmail(input = {}) {
    try {
        const config = await loadConfig();

        // Auto-detect provider if not specified
        let providerConfig = {};
        const userEmail = input.smtp?.auth?.user || config.user;

        if (input.smtp?.provider) {
            // Use specified provider
            providerConfig = getProviderConfig(input.smtp.provider) || {};
        } else if (userEmail && !input.smtp?.host) {
            // Auto-detect from email domain
            providerConfig = getProviderConfig(userEmail) || {};
        }

        const merged = {
            smtp: {
                host: input.smtp?.host || config.host || providerConfig.host || "smtp.gmail.com",
                port: input.smtp?.port || config.port || providerConfig.port || 465,
                secure: typeof input.smtp?.secure === "boolean"
                    ? input.smtp.secure
                    : (config.secure ?? providerConfig.secure ?? true),
                requireTLS: input.smtp?.requireTLS ?? config.requireTLS ?? providerConfig.requireTLS ?? false,
                ignoreTLS: input.smtp?.ignoreTLS ?? config.ignoreTLS ?? false,
                connectionTimeout: input.smtp?.connectionTimeout || config.connectionTimeout || 60000,
                greetingTimeout: input.smtp?.greetingTimeout || config.greetingTimeout || 30000,
                socketTimeout: input.smtp?.socketTimeout || config.socketTimeout || 60000,
                debug: input.smtp?.debug ?? config.debug ?? false,
                name: input.smtp?.name || config.name || os.hostname(),
                pool: input.smtp?.pool || config.pool || {},
                usePool: input.smtp?.usePool ?? config.usePool ?? true,
                auth: {
                    user: input.smtp?.auth?.user || config.user,
                    pass: input.smtp?.auth?.pass || config.pass,
                    type: input.smtp?.auth?.type || config.authType || "login",
                    ...input.smtp?.auth,
                },
                // DKIM signing config (optional) — forwarded as-is to the SMTP client
                dkim: input.smtp?.dkim || undefined,
                logger: input.smtp?.logger || config.logger || undefined,
                dev: input.smtp?.dev ?? config.dev ?? false,
                proxy: input.smtp?.proxy,
            },
            mail: {
                from: input.mail?.from || input.mail?.fromEmail || config.fromEmail || userEmail,
                to: input.mail?.to,
                cc: input.mail?.cc,
                bcc: input.mail?.bcc,
                replyTo: input.mail?.replyTo || config.replyTo,
                subject: input.mail?.subject,
                html: input.mail?.html,
                text: input.mail?.text,
                headers: input.mail?.headers || {},
                priority: input.mail?.priority || "normal",
                attachments: input.mail?.attachments || [],
                fromName: input.mail?.fromName || config.fromName || "Senderwolf",
                fromEmail: input.mail?.fromEmail || config.fromEmail || userEmail,
                encoding: input.mail?.encoding || "utf8",
                date: input.mail?.date,
                messageId: input.mail?.messageId,
                amp: input.mail?.amp,
                dsn: input.mail?.dsn,
                calendar: input.mail?.calendar,
                bimi: input.mail?.bimi,
                dmarc: input.mail?.dmarc,
                inlineCSS: input.mail?.inlineCSS,
                minify: input.mail?.minify,
                verifyDomain: input.mail?.verifyDomain ?? config.verifyDomain,
                subjects: input.mail?.subjects || [],
                dryRun: input.mail?.dryRun ?? config.dryRun ?? false,
            },
            retry: input.retry || {},
            queue: input.queue,
            sendAt: input.sendAt || input.mail?.sendAt,
            delay: input.delay || input.mail?.delay,
            failover: input.failover || [],
        };

        const { smtp, mail, retry, queue } = validateInput(merged);

        // Handle Recipient Domain Validation (MX Check)
        if (mail.verifyDomain) {
            const recipients = [];
            if (mail.to) Array.isArray(mail.to) ? recipients.push(...mail.to) : recipients.push(mail.to);
            if (mail.cc) Array.isArray(mail.cc) ? recipients.push(...mail.cc) : recipients.push(mail.cc);
            if (mail.bcc) Array.isArray(mail.bcc) ? recipients.push(...mail.bcc) : recipients.push(mail.bcc);
            
            await validateRecipientsMX(recipients);
        }

        // Handle calendar event: auto-generate ICS attachment and fallback body
        if (mail.calendar) {
            const icsString = generateICS(mail.calendar);
            const icsBuffer = Buffer.from(icsString, 'utf8');
            const method = mail.calendar.method || 'REQUEST';
            // Prepend ICS attachment (before any user-provided attachments)
            mail.attachments = [
                {
                    filename: 'invite.ics',
                    content: icsBuffer,
                    contentType: `text/calendar; charset=utf-8; method=${method}`,
                },
                ...(mail.attachments || []),
            ];
            // Auto-generate plain-text fallback if no body is provided
            if (!mail.html && !mail.text && !mail.amp) {
                const start = mail.calendar.start.toUTCString();
                const end   = mail.calendar.end.toUTCString();
                let fallback = `You have been invited to: ${mail.calendar.summary}\n`;
                fallback += `When: ${start} \u2013 ${end}\n`;
                if (mail.calendar.location) fallback += `Where: ${mail.calendar.location}\n`;
                if (mail.calendar.description) fallback += `\n${mail.calendar.description}\n`;
                fallback += `\nPlease open the attached .ics file to add this event to your calendar.`;
                mail.text = fallback;
            }
        }

        // Handle CSS Inlining and Minification
        if (mail.html) {
            if (mail.inlineCSS) {
                mail.html = inlineCSS(mail.html);
            }
            if (mail.minify) {
                mail.html = minifyHTML(mail.html);
            }
        }

        // Handle BIMI and DMARC Headers
        if (mail.bimi) {
            mail.headers = mail.headers || {};
            mail.headers['BIMI-Location'] = mail.bimi.location;
            if (mail.bimi.selector) {
                mail.headers['BIMI-Selector'] = mail.bimi.selector;
            }
        }

        if (mail.dmarc) {
            mail.headers = mail.headers || {};
            let dmarcVal = `policy=${mail.dmarc.policy || 'none'}`;
            if (mail.dmarc.report) dmarcVal += '; report=true';
            mail.headers['DMARC-Filter'] = dmarcVal;
        }

        // Handle A/B Testing: Pick one subject if multiple are provided
        let selectedSubject = mail.subject;
        if (mail.subjects && mail.subjects.length > 0 && !selectedSubject) {
            selectedSubject = mail.subjects[Math.floor(Math.random() * mail.subjects.length)];
        }

        // Pre-process attachments: sanitize filenames and infer names (W4, W5 fix)
        if (mail.attachments && mail.attachments.length > 0) {
            mail.attachments = mail.attachments.map(att => {
                let filename = att.filename;
                if (att.path && !filename) {
                    filename = path.basename(att.path);
                }
                
                if (filename) {
                    filename = filename.replace(/[\r\n"<>|]/g, '').trim();
                } else if (att.cid) {
                    filename = `inline-${att.cid.replace(/[^a-zA-Z0-9]/g, '')}`;
                }

                return {
                    ...att,
                    filename,
                    disposition: att.disposition || (att.cid ? 'inline' : 'attachment')
                };
            });
        }

        const mailOptions = {
            from: mail.fromEmail,
            fromHeader: mail.fromName
                ? `"${String(mail.fromName).replace(/"/g, '\\"')}" <${mail.fromEmail}>`
                : (mail.from || mail.fromEmail),
            to: mail.to,
            cc: mail.cc,
            bcc: mail.bcc,
            replyTo: mail.replyTo,
            subject: selectedSubject,
            text: mail.text || (mail.html ? htmlToText(mail.html) : undefined),
            html: mail.html,
            headers: mail.headers,
            priority: mail.priority,
            attachments: mail.attachments,
            encoding: mail.encoding,
            date: mail.date,
            messageId: mail.messageId,
            amp: mail.amp,
            dsn: mail.dsn,
        };

        // Build event context for lifecycle hooks
        const eventCtx = {
            to: mail.to,
            subject: selectedSubject,
        };

        const retryOptions = retry || {};
        const startTime = Date.now();

        // Handle scheduling/delayed send
        let waitTime = 0;
        if (merged.sendAt instanceof Date) {
            waitTime = Math.max(0, merged.sendAt.getTime() - Date.now());
        } else if (typeof merged.sendAt === "string") {
            // Basic support for "5m" etc in sendAt
            waitTime = parseInterval(merged.sendAt);
        } else if (merged.delay) {
            waitTime = parseInterval(merged.delay);
        }

        if (queue && queue.store) {
            // Enqueue the job instead of waiting in-memory
            const payload = {
                smtp,
                mailOptions,
                retryOptions,
                eventCtx,
                waitTime,
                sendAt: merged.sendAt,
            };
            const jobId = await queue.store.enqueue(payload);
            
            senderwolfEvents.emitQueued({ ...eventCtx, queueJobId: jobId });
            
            return {
                success: true,
                queueJobId: jobId,
                queued: true,
                attempts: 0,
                scheduled: waitTime > 0,
            };
        }

        if (waitTime > 0) {
            logger.info(`Scheduling email to ${mail.to} in ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Handle Dry Run mode (W2 fix)
        if (mail.dryRun) {
            logger.info(`Dry run mode enabled for ${mail.to}. Skipping SMTP delivery.`);
            return {
                success: true,
                messageId: mail.messageId || `dry-run-${Date.now()}.${Math.random().toString(36).substring(2, 11)}@${os.hostname()}`,
                dryRun: true,
                mailOptions: mailOptions,
                attempts: 0
            };
        }

        // Smart Failover Logic
        const configsToTry = [smtp, ...(merged.failover || [])];
        let lastError = null;
        let totalAttempts = 0;

        for (let i = 0; i < configsToTry.length; i++) {
            const currentSmtp = configsToTry[i];
            try {
                const { result: messageId, attempts } = await withRetry(
                    async (attempt) => {
                        // Emit 'sending' before each attempt
                        senderwolfEvents.emitSending({ ...eventCtx, attempt: totalAttempts + attempt });
                        return await coreSend(currentSmtp, mailOptions);
                    },
                    retryOptions,
                    {
                        onRetry: ({ attempt, maxRetries: max, delay, error }) => {
                            senderwolfEvents.emitFailed({
                                error,
                                ...eventCtx,
                                attempt: totalAttempts + attempt,
                                willRetry: true,
                            });
                            senderwolfEvents.emitRetrying({
                                ...eventCtx,
                                attempt: totalAttempts + attempt + 1,
                                maxRetries: max,
                                delay,
                                error,
                            });
                        },
                    }
                );

                const elapsed = Date.now() - startTime;
                senderwolfEvents.emitSent({
                    messageId,
                    ...eventCtx,
                    elapsed,
                    attempt: totalAttempts + attempts,
                });

                // For dev mode, return the captured result which includes previews
                const extraResult = currentSmtp.dev ? { 
                    html: mailOptions.html, 
                    text: mailOptions.text, 
                    subject: mailOptions.subject,
                    headers: mailOptions.headers,
                } : {};

                return {
                    success: true,
                    messageId: typeof messageId === 'string' ? messageId : messageId?.messageId,
                    ...extraResult,
                    attempts: totalAttempts + attempts,
                    scheduled: waitTime > 0,
                    transport: i === 0 ? 'primary' : `failover-${i}`
                };
            } catch (error) {
                lastError = error;
                totalAttempts += (retryOptions.maxRetries || 0) + 1;
                
                if (i < configsToTry.length - 1) {
                    logger.warn(`Transport ${i === 0 ? 'primary' : 'failover-' + i} failed: ${error.message}. Trying next failover transport...`);
                }
            }
        }

        // If we reach here, all transports failed
        const errorMessage = lastError?.message || "All transports failed while sending email";
        senderwolfEvents.emitFailed({
            error: errorMessage,
            to: mail.to,
            subject: selectedSubject || mail.subject || '(no subject)',
            attempt: totalAttempts,
            willRetry: false,
        });

        return {
            success: false,
            error: errorMessage,
            attempts: totalAttempts,
        };
    } catch (error) {
        const errorMessage = error.message || "Unknown error while sending email";
        // Emit 'failed' with willRetry=false (final failure)
        senderwolfEvents.emitFailed({
            error: errorMessage,
            to: input.mail?.to,
            subject: input.mail?.subject || (input.mail?.subjects?.[0]) || '(no subject)',
            attempt: (input.retry?.maxRetries || 0) + 1,
            willRetry: false,
        });

        // Preserve Zod validation issues for actionable consumer feedback (W6 fix)
        const result = {
            success: false,
            error: errorMessage,
            attempts: (input.retry?.maxRetries || 0) + 1,
        };

        if (error.name === 'ZodError' && error.issues) {
            result.issues = error.issues;
        }

        return result;
    }
}

/**
 * Close all connection pools (useful for graceful shutdown)
 */
export async function closeAllPools() {
    const closePromises = Array.from(connectionPools.values()).map(pool => pool.close());
    await Promise.all(closePromises);
    connectionPools.clear();
    // Clear circuit breakers to prevent stale OPEN state after pool teardown (W7 fix)
    circuitBreakers.clear();
}

/**
 * Get statistics for all connection pools
 */
export function getPoolStats() {
    const stats = {};
    for (const [key, pool] of connectionPools.entries()) {
        stats[key] = pool.getStats();
    }
    return stats;
}
