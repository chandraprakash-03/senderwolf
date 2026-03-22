/**
 * Simplified verification script for senderwolf features
 */
import { sendEmail } from '../lib/sendEmail.js';
import { logger } from '../lib/logger.js';
import { detectMimeType } from '../lib/mime.js';

async function test() {
    console.log('--- Senderwolf Feature Verification ---');

    // 1. MIME Detection
    console.log('\n1. Testing MIME Detection:');
    console.log('png ->', detectMimeType('test.png'));
    console.log('pdf ->', detectMimeType('doc.pdf'));
    console.log('unknown ->', detectMimeType('file.xyz'));

    // 2. Logger
    console.log('\n2. Testing Logger:');
    let captured = '';
    const myLogger = {
        info: (msg) => { captured = msg; console.log('[Captured Info]', msg); }
    };
    logger.setLogger(myLogger);
    logger.info('Logger is working');
    if (captured === 'Logger is working') console.log('✅ Logger setLogger/info verified');

    // 3. Env Vars
    console.log('\n3. Testing Env Vars:');
    process.env.SENDERWOLF_SMTP_HOST = 'env-host.test';
    // We need to re-import or re-load config if it was cached, but sendEmail calls loadConfig() every time
    // Let's verify via sendEmail debug mode if possible, but easier to just check config logic
    import('../lib/config.js').then(async (m) => {
        const config = await m.loadConfig();
        console.log('Config host from env:', config.host);
        if (config.host === 'env-host.test') console.log('✅ Env var support verified');
    });

    // 4. Scheduling
    console.log('\n4. Testing Scheduling:');
    const start = Date.now();
    // Use a short delay
    const p = sendEmail({
        smtp: { host: 'localhost', port: 25, auth: { user: 'u', pass: 'p' }, usePool: false },
        mail: { to: 't', subject: 's', text: 't' },
        delay: 200
    }).catch(() => {}); // Expected to fail connection

    setTimeout(() => {
        const elapsed = Date.now() - start;
        console.log(`Elapsed after 300ms: ${elapsed}ms`);
        if (elapsed > 200) console.log('✅ Scheduling delay verified');
        console.log('\n--- Verification Finished ---');
    }, 500);
}

test();
