import * as os from "os";
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

// Global connection pools for different SMTP configurations
const connectionPools = new Map();

/**
 * Get or create a connection pool for the given SMTP configuration
 */
function getConnectionPool(smtpConfig) {
    const poolKey = `${smtpConfig.host}:${smtpConfig.port}:${smtpConfig.auth.user}`;

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
async function coreSend(smtp, mailOptions) {
    let connection = null;
    let pool = null;

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

        return messageId;
    } catch (error) {
        if (connection && pool) {
            pool.releaseConnection(connection);
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
                calendar: input.mail?.calendar,
            },
            retry: input.retry || {},
            sendAt: input.sendAt || input.mail?.sendAt,
            delay: input.delay || input.mail?.delay,
        };

        const { smtp, mail, retry } = validateInput(merged);

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
            if (!mail.html && !mail.text) {
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

        const mailOptions = {
            from: mail.from || mail.fromEmail,
            fromHeader: mail.fromName ? `"${mail.fromName}" <${mail.fromEmail}>` : mail.fromEmail,
            to: mail.to,
            cc: mail.cc,
            bcc: mail.bcc,
            replyTo: mail.replyTo,
            subject: mail.subject,
            text: mail.text || (mail.html ? htmlToText(mail.html) : undefined),
            html: mail.html,
            headers: mail.headers,
            priority: mail.priority,
            attachments: mail.attachments,
            encoding: mail.encoding,
            date: mail.date,
            messageId: mail.messageId,
        };

        // Build event context for lifecycle hooks
        const eventCtx = {
            to: mail.to,
            subject: mail.subject,
        };

        const retryOptions = retry || {};
        const maxRetries = retryOptions.maxRetries || 0;

        const startTime = Date.now();

        // Handle scheduling/delayed send
        let waitTime = 0;
        if (merged.sendAt instanceof Date) {
            waitTime = Math.max(0, merged.sendAt.getTime() - Date.now());
        } else if (typeof merged.delay === "number") {
            waitTime = Math.max(0, merged.delay);
        }

        if (waitTime > 0) {
            logger.info(`Scheduling email to ${mail.to} in ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const { result: messageId, attempts } = await withRetry(
            async (attempt) => {
                // Emit 'sending' before each attempt
                senderwolfEvents.emitSending({ ...eventCtx, attempt });

                return await coreSend(smtp, mailOptions);
            },
            retryOptions,
            {
                onRetry: ({ attempt, maxRetries: max, delay, error }) => {
                    // Emit 'failed' for the attempt that just failed (with willRetry=true)
                    senderwolfEvents.emitFailed({
                        error,
                        ...eventCtx,
                        attempt,
                        willRetry: true,
                    });

                    // Emit 'retrying' before the delay
                    senderwolfEvents.emitRetrying({
                        ...eventCtx,
                        attempt: attempt + 1,
                        maxRetries: max,
                        delay,
                        error,
                    });
                },
            }
        );

        const elapsed = Date.now() - startTime;

        // Emit 'sent' on success
        senderwolfEvents.emitSent({
            messageId,
            ...eventCtx,
            elapsed,
            attempt: attempts,
        });

        return {
            success: true,
            messageId: messageId,
            attempts,
            scheduled: waitTime > 0,
        };
    } catch (error) {
        const errorMessage = error.message || "Unknown error while sending email";

        // Emit 'failed' with willRetry=false (final failure)
        senderwolfEvents.emitFailed({
            error: errorMessage,
            to: input.mail?.to,
            subject: input.mail?.subject,
            attempt: (input.retry?.maxRetries || 0) + 1,
            willRetry: false,
        });

        return {
            success: false,
            error: errorMessage,
            attempts: (input.retry?.maxRetries || 0) + 1,
        };
    }
}

/**
 * Close all connection pools (useful for graceful shutdown)
 */
export async function closeAllPools() {
    const closePromises = Array.from(connectionPools.values()).map(pool => pool.close());
    await Promise.all(closePromises);
    connectionPools.clear();
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
