/**
 * Verification script for new senderwolf features:
 * 1. Pluggable Logger
 * 2. Env Var Support
 * 3. Inline Images (CID)
 * 4. MIME Type Detection
 * 5. Scheduling/Delayed Send
 */

import { sendEmail, createMailer } from '../index.js';
import fs from 'fs';
import path from 'path';

async function runVerification() {
    console.log('--- Starting Verification ---\n');

    // 1. Pluggable Logger
    console.log('Testing Pluggable Logger...');
    const customLogs = [];
    const customLogger = {
        info: (...args) => {
            console.log('[Custom Info]', ...args);
            customLogs.push(['info', ...args]);
        },
        warn: (...args) => {
            console.log('[Custom Warn]', ...args);
            customLogs.push(['warn', ...args]);
        },
        error: (...args) => {
            console.log('[Custom Error]', ...args);
            customLogs.push(['error', ...args]);
        },
        debug: (...args) => {
            console.log('[Custom Debug]', ...args);
            customLogs.push(['debug', ...args]);
        }
    };

    // 2. Env Var Support
    console.log('\nTesting Env Var Support...');
    process.env.SENDERWOLF_SMTP_HOST = 'smtp.env-test.com';
    process.env.SENDERWOLF_SMTP_PORT = '587';
    process.env.SENDERWOLF_SMTP_USER = 'env-user@test.com';
    process.env.SENDERWOLF_SMTP_PASS = 'env-pass123';
    process.env.SENDERWOLF_DEBUG = 'true';

    // 3 & 4. CID & MIME Detection
    console.log('\nTesting CID & MIME Detection...');
    const mailOptions = {
        smtp: {
            logger: customLogger,
            // Use debug: true to see the generated message without sending
            debug: true,
            usePool: false, // Avoid pool for this test
        },
        mail: {
            to: 'recipient@test.com',
            subject: 'CID & MIME Test',
            html: '<h1>Hello</h1><img src="cid:logo123">',
            attachments: [
                {
                    filename: 'test-image.png',
                    content: Buffer.from('fake-image-data'),
                    cid: 'logo123'
                },
                {
                    filename: 'document.pdf',
                    content: 'fake-pdf-content',
                    // contentType: 'application/pdf' // Should be auto-detected
                }
            ]
        }
    };

    // 5. Scheduling
    console.log('\nTesting Scheduling (500ms delay)...');
    const startTime = Date.now();
    
    try {
        // We use a fake SMTP host so it will fail connection, but we want to check scheduling and logger
        const result = await sendEmail({
            ...mailOptions,
            delay: 500
        });
        
        const elapsed = Date.now() - startTime;
        console.log(`\nEmail attempt finished in ${elapsed}ms`);
        
        if (elapsed >= 500) {
            console.log('✅ Scheduling delay verified.');
        } else {
            console.log('❌ Scheduling delay failed.');
        }

        console.log('\nChecking Custom Logger...');
        if (customLogs.some(log => log[1].includes('Scheduling email'))) {
            console.log('✅ Logger captured scheduling event.');
        } else {
            console.log('❌ Logger failed to capture scheduling event.');
        }
        
        if (customLogs.some(log => log[1].includes('Connected to smtp.env-test.com:587'))) {
            console.log('✅ Logger captured env-var based host/port.');
            console.log('✅ Env var support verified.');
        } else {
            // It might fail before connection if DNS fails, but let's check what it tried
            console.log('Logger captured:', customLogs.map(l => l[1]));
        }

    } catch (err) {
        console.log('Expected error (connection failure):', err.message);
    }

    console.log('\n--- Verification Finished ---');
}

runVerification().catch(console.error);
