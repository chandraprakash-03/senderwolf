/**
 * Enhanced SMTP client implementation with multiple auth methods and better error handling
 */

import * as tls from "node:tls";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import { ConnectionError, AuthenticationError, SMTPError, AttachmentError } from "./errors.js";
import * as os from "node:os";
import { signMessage } from "./dkim.js";
import { logger } from "./logger.js";
import { detectMimeType } from "./mime.js";
import { Buffer } from "node:buffer";
import { createProxySocket } from "./proxy.js";

export class SMTPClient {
    constructor(config) {
        this.host = config.host;
        this.port = config.port;
        this.secure = config.secure;
        this.requireTLS = config.requireTLS || false;
        this.ignoreTLS = config.ignoreTLS || false;
        this.auth = config.auth;
        this.connectionTimeout = config.connectionTimeout || 60000;
        this.greetingTimeout = config.greetingTimeout || 30000;
        this.socketTimeout = config.socketTimeout || 60000;
        this.debug = config.debug || false;
        this.name = config.name || os.hostname();
        this.dkim = config.dkim || null; // Optional DKIM signing config
        this.logger = config.logger || logger;
        this.proxy = config.proxy || null;
        this.socket = null;
        this.buffer = "";
        this.capabilities = new Set();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.socket?.destroy();
                reject(new ConnectionError(`Connection timeout after ${this.connectionTimeout}ms`));
            }, this.connectionTimeout);

            const onConnect = () => {
                clearTimeout(timeout);
                this.socket.removeListener("error", onError);
                this.socket.setTimeout(this.socketTimeout);
                if (this.debug) this.logger.info(`Connected to ${this.host}:${this.port}`);
                resolve();
            };

            const onError = (err) => {
                clearTimeout(timeout);
                this.socket?.removeListener("connect", onConnect);
                reject(new ConnectionError(`Connection failed: ${err.message}`));
            };

            if (this.proxy) {
                createProxySocket(this.proxy, this.host, this.port, this.connectionTimeout)
                    .then(socket => {
                        this.socket = socket;
                        if (this.secure) {
                            const secureSocket = tls.connect({
                                socket: this.socket,
                                host: this.host,
                                port: this.port,
                                servername: this.host,
                                rejectUnauthorized: !this.ignoreTLS
                            });
                            secureSocket.once('secureConnect', () => {
                                this.socket = secureSocket;
                                this.socket.setEncoding('utf8');
                                onConnect();
                            });
                            secureSocket.once('error', onError);
                        } else {
                            onConnect();
                        }
                    })
                    .catch(onError);
                return;
            }

            if (this.secure) {
                this.socket = tls.connect({
                    host: this.host,
                    port: this.port,
                    servername: this.host,
                    rejectUnauthorized: !this.ignoreTLS
                });
            } else {
                this.socket = net.connect({ host: this.host, port: this.port });
            }

            this.socket.once("connect", onConnect);
            this.socket.once("error", onError);
            this.socket.setEncoding("utf8");
        });
    }

    async readResponse() {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.socket.removeListener('data', onData);
                this.socket.removeListener('error', onError);
                reject(new ConnectionError(`SMTP response timeout after ${this.socketTimeout}ms`));
            }, this.socketTimeout);

            const onData = (chunk) => {
                this.buffer += chunk;
                const lines = this.buffer.split("\r\n");

                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i];
                    if (line.length >= 3 && line[3] === " ") {
                        this.buffer = lines.slice(i + 1).join("\r\n");
                        this.socket.removeListener("data", onData);
                        this.socket.removeListener("error", onError);
                        clearTimeout(timer);
                        resolve(line);
                        return;
                    }
                }
            };

            const onError = (err) => {
                clearTimeout(timer);
                this.socket.removeListener("data", onData);
                reject(err);
            };

            this.socket.on("data", onData);
            this.socket.once("error", onError);
        });
    }

    async readMultiLineResponse() {
        return new Promise((resolve, reject) => {
            const responseLines = [];

            const timer = setTimeout(() => {
                this.socket.removeListener('data', onData);
                this.socket.removeListener('error', onError);
                reject(new ConnectionError(`SMTP multi-line response timeout after ${this.socketTimeout}ms`));
            }, this.socketTimeout);

            const onData = (chunk) => {
                this.buffer += chunk;
                const lines = this.buffer.split("\r\n");

                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i];
                    if (line.length >= 3) {
                        responseLines.push(line);

                        // Check if this is the final line (space after code)
                        if (line[3] === " ") {
                            this.buffer = lines.slice(i + 1).join("\r\n");
                            this.socket.removeListener("data", onData);
                            this.socket.removeListener("error", onError);
                            clearTimeout(timer);
                            resolve(responseLines.join("\n"));
                            return;
                        }
                    }
                }
            };

            const onError = (err) => {
                clearTimeout(timer);
                this.socket.removeListener("data", onData);
                reject(err);
            };

            this.socket.on("data", onData);
            this.socket.once("error", onError);
        });
    }

    async sendCommand(command, expectCode = "250") {
        this.socket.write(command + "\r\n");
        const response = await this.readResponse();
        if (!response.startsWith(expectCode)) {
            const code = parseInt(response.substring(0, 3), 10) || null;
            throw new SMTPError(`SMTP Error: ${response}`, response, code);
        }
        return response;
    }

    async sendEhloCommand(command, expectCode = "250") {
        this.socket.write(command + "\r\n");
        const response = await this.readMultiLineResponse();
        if (!response.startsWith(expectCode)) {
            throw new Error(`SMTP Error: ${response}`);
        }
        return response;
    }

    async authenticate() {
        // Send EHLO and parse capabilities
        const ehloResponse = await this.sendEhloCommand("EHLO " + this.name);
        this.parseCapabilities(ehloResponse);

        // Handle STARTTLS if required
        if (this.requireTLS && !this.secure && this.capabilities.has('STARTTLS')) {
            await this.sendCommand("STARTTLS", "220");
            await this.upgradeToTLS();
            // Re-send EHLO after STARTTLS
            const newEhloResponse = await this.sendEhloCommand("EHLO " + this.name);
            this.parseCapabilities(newEhloResponse);
        }

        // Authenticate based on auth type
        const authType = this.auth.type || 'login';

        switch (authType.toLowerCase()) {
            case 'login':
                await this.authLogin();
                break;
            case 'plain':
                await this.authPlain();
                break;
            case 'oauth2':
                await this.authOAuth2();
                break;
            case 'xoauth2':
                await this.authXOAuth2();
                break;
            default:
                throw new AuthenticationError(`Unsupported authentication method: ${authType}`);
        }
    }

    parseCapabilities(ehloResponse) {
        // Parse EHLO response to extract server capabilities
        const lines = ehloResponse.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('250-') || trimmed.startsWith('250 ')) {
                const capability = trimmed.substring(4).split(' ')[0];
                this.capabilities.add(capability.toUpperCase());
            }
        }
        if (this.debug) this.logger.info('Server capabilities:', Array.from(this.capabilities));
    }

    async upgradeToTLS() {
        return new Promise((resolve, reject) => {
            const secureSocket = tls.connect({
                socket: this.socket,
                servername: this.host,
                rejectUnauthorized: !this.ignoreTLS
            });

            secureSocket.once('secureConnect', () => {
                this.socket = secureSocket;
                this.socket.setEncoding("utf8");
                if (this.debug) this.logger.info('Upgraded to TLS');
                resolve();
            });

            secureSocket.once('error', reject);
        });
    }

    async authLogin() {
        if (!this.capabilities.has('AUTH')) {
            throw new AuthenticationError('Server does not support AUTH (LOGIN authentication)');
        }

        await this.sendCommand("AUTH LOGIN", "334");
        await this.sendCommand(Buffer.from(this.auth.user).toString("base64"), "334");
        await this.sendCommand(Buffer.from(this.auth.pass).toString("base64"), "235");
    }

    async authPlain() {
        if (!this.capabilities.has('AUTH')) {
            throw new AuthenticationError('Server does not support AUTH (PLAIN authentication)');
        }

        const authString = Buffer.from(`\0${this.auth.user}\0${this.auth.pass}`).toString('base64');
        await this.sendCommand(`AUTH PLAIN ${authString}`, "235");
    }

    async authOAuth2() {
        // Simplified OAuth2 implementation
        if (!this.auth.accessToken) {
            throw new AuthenticationError('OAuth2 access token is required');
        }

        const authString = `user=${this.auth.user}\x01auth=Bearer ${this.auth.accessToken}\x01\x01`;
        const base64Auth = Buffer.from(authString).toString('base64');
        await this.sendCommand(`AUTH OAUTHBEARER ${base64Auth}`, "235");
    }

    async authXOAuth2() {
        if (!this.auth.accessToken) {
            throw new AuthenticationError('XOAUTH2 access token is required');
        }

        const authString = `user=${this.auth.user}\x01auth=Bearer ${this.auth.accessToken}\x01\x01`;
        const base64Auth = Buffer.from(authString).toString('base64');
        await this.sendCommand(`AUTH XOAUTH2 ${base64Auth}`, "235");
    }

    async sendMail(mailOptions) {
        // Sanitize envelope addresses to prevent SMTP command injection (SEC-1)
        const sanitizeEnvelopeAddr = (addr) => String(addr).replace(/[\r\n<>]/g, '');

        let mailFromCmd = `MAIL FROM:<${sanitizeEnvelopeAddr(mailOptions.from)}>`;
        if (mailOptions.dsn) {
            if (mailOptions.dsn.return) mailFromCmd += ` RET=${mailOptions.dsn.return.toUpperCase()}`;
            if (mailOptions.dsn.id) mailFromCmd += ` ENVID=${mailOptions.dsn.id}`;
        }
        await this.sendCommand(mailFromCmd);

        // Collect all recipients (TO, CC, BCC)
        const allRecipients = [];

        // Add TO recipients
        const toRecipients = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
        allRecipients.push(...toRecipients);

        // Add CC recipients
        if (mailOptions.cc) {
            const ccRecipients = Array.isArray(mailOptions.cc) ? mailOptions.cc : [mailOptions.cc];
            allRecipients.push(...ccRecipients);
        }

        // Add BCC recipients
        if (mailOptions.bcc) {
            const bccRecipients = Array.isArray(mailOptions.bcc) ? mailOptions.bcc : [mailOptions.bcc];
            allRecipients.push(...bccRecipients);
        }

        // Send RCPT TO for all recipients
        for (const recipient of allRecipients) {
            const email = sanitizeEnvelopeAddr(this.extractEmail(recipient.trim()));
            let rcptToCmd = `RCPT TO:<${email}>`;
            if (mailOptions.dsn) {
                if (mailOptions.dsn.notify) {
                    const notify = Array.isArray(mailOptions.dsn.notify) ? mailOptions.dsn.notify.join(',') : mailOptions.dsn.notify;
                    rcptToCmd += ` NOTIFY=${notify.toUpperCase()}`;
                }
                if (mailOptions.dsn.recipient) {
                    rcptToCmd += ` ORCPT=rfc822;${mailOptions.dsn.recipient}`;
                }
            }
            await this.sendCommand(rcptToCmd);
        }

        await this.sendCommand("DATA", "354");

        const messageId = mailOptions.messageId || `<${Date.now()}.${Math.random().toString(36).substring(2, 11)}@${this.host}>`;
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        // PERF-1: Accumulate message parts in an array to avoid O(n²) string concatenation
        const parts = [];

        parts.push(`From: ${mailOptions.fromHeader}\r\n`);
        parts.push(`To: ${toRecipients.join(", ")}\r\n`);

        // Add CC header (but not BCC for privacy)
        if (mailOptions.cc) {
            const ccRecipients = Array.isArray(mailOptions.cc) ? mailOptions.cc : [mailOptions.cc];
            parts.push(`Cc: ${ccRecipients.join(", ")}\r\n`);
        }

        // Add Reply-To if specified
        if (mailOptions.replyTo) {
            parts.push(`Reply-To: ${mailOptions.replyTo}\r\n`);
        }

        parts.push(`Subject: ${mailOptions.subject}\r\n`);
        parts.push(`Message-ID: ${messageId}\r\n`);
        parts.push(`Date: ${mailOptions.date ? mailOptions.date.toUTCString() : new Date().toUTCString()}\r\n`);

        // Add priority header
        if (mailOptions.priority && mailOptions.priority !== 'normal') {
            const priorityMap = { high: '1 (Highest)', low: '5 (Lowest)' };
            parts.push(`X-Priority: ${priorityMap[mailOptions.priority]}\r\n`);
        }

        // Add custom headers (sanitized to prevent SMTP header injection)
        if (mailOptions.headers) {
            for (const [key, value] of Object.entries(mailOptions.headers)) {
                const safeKey = String(key).replace(/[\r\n:]/g, '');
                const safeValue = String(value).replace(/\r\n|\r|\n/g, ' ').trim();
                parts.push(`${safeKey}: ${safeValue}\r\n`);
            }
        }

        parts.push(`MIME-Version: 1.0\r\n`);

        // Separate calendar attachments from regular ones, so we can embed them inline
        let calendarAttachments = [];
        let regularAttachments = [];
        const hasAttachments = mailOptions.attachments && mailOptions.attachments.length > 0;

        if (hasAttachments) {
            for (const attachment of mailOptions.attachments) {
                if (attachment.contentType && attachment.contentType.startsWith("text/calendar")) {
                    calendarAttachments.push(attachment);
                } else {
                    regularAttachments.push(attachment);
                }
            }
        }

        const hasRegularAttachments = regularAttachments.length > 0;

        if (hasRegularAttachments) {
            parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`);
            parts.push(`--${boundary}\r\n`);
        }

        // If we have text/calendar parts, we inject them into multipart/alternative so clients auto-render them
        if (mailOptions.html || mailOptions.text || mailOptions.amp || calendarAttachments.length > 0) {
            const altBoundary = `----=_Part_Alt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`);
            
            // 1. Plain text first
            if (mailOptions.text) {
                parts.push(`--${altBoundary}\r\n`);
                parts.push(`Content-Type: text/plain; charset=utf-8\r\n\r\n`);
                parts.push(`${mailOptions.text}\r\n\r\n`);
            }
            
            // 2. HTML second (preferred over text)
            if (mailOptions.html) {
                parts.push(`--${altBoundary}\r\n`);
                parts.push(`Content-Type: text/html; charset=utf-8\r\n\r\n`);
                parts.push(`${mailOptions.html}\r\n\r\n`);
            }

            // 3. AMP HTML third (preferred over standard HTML for clients like Gmail)
            if (mailOptions.amp) {
                parts.push(`--${altBoundary}\r\n`);
                parts.push(`Content-Type: text/x-amp-html; charset=utf-8\r\n\r\n`);
                parts.push(`${mailOptions.amp}\r\n\r\n`);
            }

            // 4. Calendar fourth (most preferred in clients like Outlook/Gmail)
            for (const cal of calendarAttachments) {
                parts.push(`--${altBoundary}\r\n`);
                parts.push(`Content-Type: ${cal.contentType}\r\n`);
                parts.push(`Content-Transfer-Encoding: base64\r\n\r\n`);

                let fileContent = cal.content;
                if (cal.path) {
                    this._validateAttachmentPath(cal.path);
                    fileContent = fs.readFileSync(cal.path);
                }
                
                let base64Content;
                if (Buffer.isBuffer(fileContent)) {
                    base64Content = fileContent.toString("base64");
                } else {
                    base64Content = Buffer.from(String(fileContent)).toString("base64");
                }

                for (let i = 0; i < base64Content.length; i += 76) {
                    parts.push(base64Content.substring(i, i + 76) + "\r\n");
                }
                parts.push(`\r\n`);
            }

            parts.push(`--${altBoundary}--\r\n`);
        }

        if (hasRegularAttachments) {
            for (const attachment of regularAttachments) {
                let fileContent;
                let filename = attachment.filename;
                let contentType = attachment.contentType;

                if (attachment.path) {
                    // SEC-5: Validate attachment paths to prevent directory traversal
                    this._validateAttachmentPath(attachment.path);
                    fileContent = fs.readFileSync(attachment.path);
                    filename = filename || path.basename(attachment.path);
                } else if (attachment.content) {
                    fileContent = attachment.content;
                } else {
                    continue;
                }

                if (!contentType) {
                    contentType = detectMimeType(filename);
                }

                let base64Content;
                if (Buffer.isBuffer(fileContent)) {
                    base64Content = fileContent.toString("base64");
                } else if (typeof fileContent === "string") {
                    const encoding = attachment.encoding === "base64" ? "base64" : "utf8";
                    base64Content = Buffer.from(fileContent, encoding === "base64" ? "base64" : "utf8").toString("base64");
                } else if (fileContent && typeof fileContent.read === "function") {
                    // Stream not supported synchronously here, but throw helpful error
                    throw new AttachmentError("Stream attachments must be read into a Buffer before sending in this version.");
                } else {
                    base64Content = Buffer.from(String(fileContent)).toString("base64");
                }

                parts.push(`\r\n--${boundary}\r\n`);
                parts.push(`Content-Type: ${contentType}; name="${filename}"\r\n`);
                parts.push(`Content-Transfer-Encoding: base64\r\n`);
                
                if (attachment.cid) {
                    parts.push(`Content-ID: <${attachment.cid}>\r\n`);
                    parts.push(`Content-Disposition: inline; filename="${filename}"\r\n\r\n`);
                } else {
                    parts.push(`Content-Disposition: attachment; filename="${filename}"\r\n\r\n`);
                }

                for (let i = 0; i < base64Content.length; i += 76) {
                    parts.push(base64Content.substring(i, i + 76) + "\r\n");
                }
            }
            parts.push(`--${boundary}--\r\n`);
        }

        // Join all parts into the final message (PERF-1: single allocation)
        let message = parts.join('');

        // The trailing DATA terminator — kept separate so DKIM signs only the real message
        const terminator = "\r\n.\r\n";

        // Apply DKIM signature if configured
        if (this.dkim) {
            try {
                message = signMessage(message, this.dkim);
            } catch (dkimErr) {
                throw new SMTPError(`DKIM signing failed: ${dkimErr.message}`);
            }
        }

        // RFC 5321 §4.5.2 — Dot-stuffing: lines starting with '.' must be doubled
        message = message.replace(/\r\n\./g, '\r\n..');

        this.socket.write(message + terminator);

        const response = await this.readResponse();
        if (!response.startsWith("250")) {
            const code = parseInt(response.substring(0, 3), 10) || null;
            throw new SMTPError(`Failed to send email: ${response}`, response, code);
        }

        return messageId;
    }

    /**
     * Validate an attachment file path to prevent directory traversal (SEC-5).
     * Rejects paths containing '..' segments which could be used to read
     * arbitrary files outside the intended directory.
     * @param {string} filePath - The attachment file path to validate
     * @throws {AttachmentError} If the path contains traversal patterns
     */
    _validateAttachmentPath(filePath) {
        const resolved = path.resolve(filePath);
        // Reject if the path contains any '..' segments (traversal attempt)
        const normalized = path.normalize(filePath);
        if (normalized.includes('..')) {
            throw new AttachmentError(
                `Attachment path "${filePath}" contains directory traversal ('..') and was rejected for security. ` +
                `Use an absolute path or a path relative to the working directory without '..' segments.`
            );
        }
    }

    extractEmail(emailString) {
        // Extract email from "Name <email@domain.com>" format
        const match = emailString.match(/<([^>]+)>/);
        return match ? match[1] : emailString;
    }

    async quit() {
        try {
            await this.sendCommand("QUIT", "221");
        } catch (e) {
            // Ignore quit errors
        }
        this.socket?.end();
        this.socket?.destroy();
    }
}