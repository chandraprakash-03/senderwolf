/**
 * DKIM Signing Example for senderwolf
 *
 * Before using DKIM you need to:
 *   1. Generate an RSA key pair:
 *        openssl genrsa -out private.pem 2048
 *        openssl rsa -in private.pem -pubout -out public.pem
 *
 *   2. Add a DNS TXT record on your domain:
 *        Host:  mail._domainkey.yourdomain.com
 *        Value: v=DKIM1; k=rsa; p=<base64-encoded-public-key>
 *
 *      Get the public key value with:
 *        node -e "const fs = require('fs'); const k = fs.readFileSync('public.pem','utf8').replace(/-----.*-----/g,'').replace(/\n/g,''); console.log(k)"
 *
 *   3. Use the private key below (inline PEM or file path).
 */

import { sendEmail, createMailer } from '../index.js';
import { readFileSync } from 'fs';

// ─── Option A: inline PEM string ────────────────────────────────────────────
// Replace with your actual private key
const inlinePem = `-----BEGIN PRIVATE KEY-----
YOUR_BASE64_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----`;

// ─── Option B: load from file (more secure) ──────────────────────────────────
// const inlinePem = readFileSync('/path/to/private.pem', 'utf8');

// ─── Example 1: sendEmail with DKIM ─────────────────────────────────────────
async function exampleSendEmail() {
    const result = await sendEmail({
        smtp: {
            host: 'smtp.yourdomain.com',
            port: 465,
            secure: true,
            auth: {
                user: 'you@yourdomain.com',
                pass: 'your-smtp-password',
            },
            // Add dkim config here — that's all it takes!
            dkim: {
                domainName: 'yourdomain.com',   // d= tag
                keySelector: 'mail',             // s= tag  →  mail._domainkey.yourdomain.com
                privateKey: inlinePem,           // or '/absolute/path/to/private.pem'
                // Optional: override which headers are signed
                // headerFields: ['from', 'to', 'subject', 'date', 'message-id'],
            },
        },
        mail: {
            from: 'you@yourdomain.com',
            to: 'recipient@example.com',
            subject: 'DKIM-signed email via senderwolf',
            html: '<h1>Hello!</h1><p>This email is DKIM-signed.</p>',
        },
    });

    console.log('Result:', result);
    // { success: true, messageId: '<...>', attempts: 1 }
}

// ─── Example 2: createMailer with DKIM ──────────────────────────────────────
async function exampleMailer() {
    const mailer = createMailer({
        smtp: {
            host: 'smtp.yourdomain.com',
            port: 465,
            secure: true,
            auth: {
                user: 'you@yourdomain.com',
                pass: 'your-smtp-password',
            },
            dkim: {
                domainName: 'yourdomain.com',
                keySelector: 'mail',
                privateKey: inlinePem,
            },
        },
        defaults: {
            fromName: 'My App',
            fromEmail: 'you@yourdomain.com',
        },
    });

    // All emails sent through this mailer will be DKIM-signed
    const result = await mailer.send({
        to: 'recipient@example.com',
        subject: 'DKIM via mailer',
        text: 'Hello from a DKIM-enabled mailer!',
    });

    console.log('Sent:', result);
    await mailer.close();
}

// ─── Example 3: load private key from file path ──────────────────────────────
async function exampleWithFilePath() {
    const result = await sendEmail({
        smtp: {
            host: 'smtp.yourdomain.com',
            port: 465,
            secure: true,
            auth: { user: 'you@yourdomain.com', pass: 'your-smtp-password' },
            dkim: {
                domainName: 'yourdomain.com',
                keySelector: 'mail',
                // Pass the file path directly — senderwolf reads it automatically
                privateKey: '/etc/senderwolf/dkim-private.pem',
            },
        },
        mail: {
            to: 'recipient@example.com',
            subject: 'DKIM via file path key',
            text: 'This key was loaded from a file path.',
        },
    });

    console.log('Sent:', result);
}

exampleSendEmail().catch(console.error);
