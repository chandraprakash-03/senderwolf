import { z } from "zod";

const email = z.string().email();

// Authentication methods
const authSchema = z.union([
    // Basic auth (LOGIN/PLAIN)
    z.object({
        user: z.string().min(1),
        pass: z.string().min(1),
        type: z.enum(["login", "plain"]).optional().default("login"),
    }),
    // OAuth2
    z.object({
        type: z.literal("oauth2"),
        user: z.string().email(),
        clientId: z.string(),
        clientSecret: z.string(),
        refreshToken: z.string(),
        accessToken: z.string().optional(),
    }),
    // XOAUTH2 (simplified)
    z.object({
        type: z.literal("xoauth2"),
        user: z.string().email(),
        accessToken: z.string(),
    }),
]);

// Pool configuration schema
const poolSchema = z
    .object({
        maxConnections: z.number().min(1).max(50).optional(),
        maxMessages: z.number().min(1).optional(),
        rateDelta: z.number().min(100).optional(),
        rateLimit: z.number().min(1).optional(),
        idleTimeout: z.number().min(1000).optional(),
    })
    .optional();

// DKIM signing configuration schema
const dkimSchema = z
    .object({
        /** The domain the email is sent from (d= tag) */
        domainName: z.string().min(1),
        /** DNS selector for the public key (s= tag) e.g. "mail" → mail._domainkey.example.com */
        keySelector: z.string().min(1),
        /** RSA private key in PEM format, or an absolute path to a PEM file */
        privateKey: z.string().min(1),
        /** Headers to include in the signature (defaults to from/to/subject/date/message-id/mime-version) */
        headerFields: z.array(z.string()).optional(),
        /** Hash algorithm — currently only sha256 is supported */
        hashAlgo: z.enum(['sha256']).optional().default('sha256'),
    })
    .optional();

// SMTP schema with enhanced options
const smtpSchema = z
    .object({
        host: z.string().optional(),
        port: z.number().min(1).max(65535).optional(),
        secure: z.boolean().optional(),
        requireTLS: z.boolean().optional().default(false),
        ignoreTLS: z.boolean().optional().default(false),
        auth: authSchema,
        connectionTimeout: z.number().optional().default(60000),
        greetingTimeout: z.number().optional().default(30000),
        socketTimeout: z.number().optional().default(60000),
        debug: z.boolean().optional().default(false),
        name: z.string().optional(), // hostname for EHLO
        provider: z.string().optional(), // provider name (gmail, outlook, etc.)
        pool: poolSchema,               // connection pool configuration
        usePool: z.boolean().optional(), // enable/disable connection pooling
        dkim: dkimSchema,               // optional DKIM signing configuration
    })
    .optional();

// Enhanced mail schema
const mailSchema = z
    .object({
        from: z.union([email, z.string()]).optional(),
        to: z.union([email, z.array(email), z.string()]),
        cc: z.union([email, z.array(email), z.string()]).optional(),
        bcc: z.union([email, z.array(email), z.string()]).optional(),
        replyTo: z.union([email, z.string()]).optional(),
        subject: z.string(),
        html: z.string().optional(),
        text: z.string().optional(),
        headers: z.record(z.string()).optional(),
        priority: z.enum(["high", "normal", "low"]).optional().default("normal"),
        fromName: z.string().optional(),
        fromEmail: email.optional(),
        attachments: z
            .array(
                z.union([
                    // File path attachment
                    z.object({
                        filename: z.string(),
                        path: z.string(),
                        contentType: z.string().optional(),
                    }),
                    // Buffer attachment
                    z.object({
                        filename: z.string(),
                        content: z.any(), // Buffer or string
                        contentType: z.string().optional(),
                        encoding: z.string().optional(),
                    }),
                    // Stream attachment
                    z.object({
                        filename: z.string(),
                        content: z.any(), // Stream
                        contentType: z.string().optional(),
                    }),
                ])
            )
            .optional(),
        encoding: z.string().optional().default("utf8"),
        date: z.date().optional(),
        messageId: z.string().optional(),
    })
    .refine((data) => data.html || data.text, {
        message: "Either 'html' or 'text' must be provided in mail body.",
        path: ["html"],
    });

// Retry configuration schema
const retrySchema = z
    .object({
        maxRetries: z.number().min(0).max(10).optional().default(0),
        initialDelay: z.number().min(100).optional().default(1000),
        backoffMultiplier: z.number().min(1).max(10).optional().default(2),
        maxDelay: z.number().min(100).optional().default(30000),
        retryableErrors: z.array(z.string()).optional(),
    })
    .optional();

export function validateInput(input) {
    const schema = z.object({
        smtp: smtpSchema,
        mail: mailSchema,
        retry: retrySchema,
    });

    return schema.parse(input);
}
