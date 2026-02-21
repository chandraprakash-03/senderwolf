/**
 * Test script for Senderwolf Retry Logic & Event System
 * Run: node examples/retry-events-test.js
 */

import { withRetry, DEFAULT_RETRY_OPTIONS } from '../lib/retry.js';
import { senderwolfEvents, on, off, once, removeAllListeners } from '../lib/events.js';
import { sendEmail, createMailer } from '../index.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ ${testName}`);
        failed++;
    }
}

// ============================================================================
// Test 1: Retry utility — function that fails N times then succeeds
// ============================================================================
async function testRetrySuccess() {
    console.log('\n📋 Test 1: Retry with eventual success');

    let callCount = 0;
    const retryInfos = [];

    const { result, attempts } = await withRetry(
        async (attempt) => {
            callCount++;
            if (callCount < 3) {
                const err = new Error('Connection timeout');
                err.code = 'ETIMEDOUT';
                throw err;
            }
            return 'success';
        },
        { maxRetries: 3, initialDelay: 50, backoffMultiplier: 2 },
        {
            onRetry: (info) => retryInfos.push(info),
        }
    );

    assert(result === 'success', 'Function eventually returned success');
    assert(attempts === 3, `Took 3 attempts (got ${attempts})`);
    assert(callCount === 3, `Function called 3 times (got ${callCount})`);
    assert(retryInfos.length === 2, `onRetry called 2 times (got ${retryInfos.length})`);
    assert(retryInfos[0].attempt === 1, 'First retry info has attempt=1');
    assert(retryInfos[1].attempt === 2, 'Second retry info has attempt=2');
}

// ============================================================================
// Test 2: Retry utility — non-retryable error (auth failure) stops immediately
// ============================================================================
async function testRetryNonRetryable() {
    console.log('\n📋 Test 2: Non-retryable error stops immediately');

    let callCount = 0;

    try {
        await withRetry(
            async () => {
                callCount++;
                throw new Error('authentication failed');
            },
            { maxRetries: 3, initialDelay: 50 }
        );
        assert(false, 'Should have thrown');
    } catch (error) {
        assert(callCount === 1, `Only called once despite maxRetries=3 (got ${callCount})`);
        assert(error.message === 'authentication failed', 'Error message preserved');
    }
}

// ============================================================================
// Test 3: Retry utility — all retries exhausted
// ============================================================================
async function testRetryExhausted() {
    console.log('\n📋 Test 3: All retries exhausted');

    let callCount = 0;

    try {
        await withRetry(
            async () => {
                callCount++;
                const err = new Error('Connection refused');
                err.code = 'ECONNREFUSED';
                throw err;
            },
            { maxRetries: 2, initialDelay: 50 }
        );
        assert(false, 'Should have thrown');
    } catch (error) {
        assert(callCount === 3, `Called 3 times (1 + 2 retries) (got ${callCount})`);
        assert(error.message === 'Connection refused', 'Last error preserved');
    }
}

// ============================================================================
// Test 4: Retry utility — zero retries (default, backward compatible)
// ============================================================================
async function testRetryDisabled() {
    console.log('\n📋 Test 4: Retry disabled by default (maxRetries=0)');

    let callCount = 0;

    try {
        await withRetry(
            async () => {
                callCount++;
                throw new Error('Connection timeout');
            },
            {} // defaults to maxRetries: 0
        );
        assert(false, 'Should have thrown');
    } catch (error) {
        assert(callCount === 1, `Only called once with default options (got ${callCount})`);
    }
}

// ============================================================================
// Test 5: Event emitter — basic event lifecycle
// ============================================================================
async function testEventEmitter() {
    console.log('\n📋 Test 5: Event emitter lifecycle');

    const events = [];

    const onSending = (data) => events.push({ type: 'sending', ...data });
    const onSent = (data) => events.push({ type: 'sent', ...data });
    const onFailed = (data) => events.push({ type: 'failed', ...data });
    const onRetrying = (data) => events.push({ type: 'retrying', ...data });

    on('sending', onSending);
    on('sent', onSent);
    on('failed', onFailed);
    on('retrying', onRetrying);

    // Emit events manually to test
    senderwolfEvents.emitSending({ to: 'test@example.com', subject: 'Test', attempt: 1 });
    senderwolfEvents.emitFailed({ error: 'timeout', to: 'test@example.com', subject: 'Test', attempt: 1, willRetry: true });
    senderwolfEvents.emitRetrying({ to: 'test@example.com', subject: 'Test', attempt: 2, maxRetries: 2, delay: 1000, error: 'timeout' });
    senderwolfEvents.emitSending({ to: 'test@example.com', subject: 'Test', attempt: 2 });
    senderwolfEvents.emitSent({ messageId: '<123@test>', to: 'test@example.com', subject: 'Test', elapsed: 150, attempt: 2 });

    assert(events.length === 5, `5 events emitted (got ${events.length})`);
    assert(events[0].type === 'sending', 'First event is sending');
    assert(events[0].attempt === 1, 'First sending event has attempt=1');
    assert(events[1].type === 'failed', 'Second event is failed');
    assert(events[1].willRetry === true, 'Failed event has willRetry=true');
    assert(events[2].type === 'retrying', 'Third event is retrying');
    assert(events[2].delay === 1000, 'Retrying event has correct delay');
    assert(events[3].type === 'sending', 'Fourth event is sending');
    assert(events[3].attempt === 2, 'Second sending event has attempt=2');
    assert(events[4].type === 'sent', 'Fifth event is sent');
    assert(events[4].messageId === '<123@test>', 'Sent event has messageId');
    assert(typeof events[4].timestamp === 'number', 'Events have timestamp');

    // Cleanup
    off('sending', onSending);
    off('sent', onSent);
    off('failed', onFailed);
    off('retrying', onRetrying);
}

// ============================================================================
// Test 6: once() only fires once
// ============================================================================
async function testOnce() {
    console.log('\n📋 Test 6: once() fires exactly once');

    let count = 0;
    once('sending', () => count++);

    senderwolfEvents.emitSending({ to: 'a@b.com', subject: 'X', attempt: 1 });
    senderwolfEvents.emitSending({ to: 'a@b.com', subject: 'X', attempt: 2 });

    assert(count === 1, `Listener fired exactly once (got ${count})`);
}

// ============================================================================
// Test 7: removeAllListeners
// ============================================================================
async function testRemoveAll() {
    console.log('\n📋 Test 7: removeAllListeners');

    let count = 0;
    on('sent', () => count++);
    on('sent', () => count++);

    removeAllListeners('sent');
    senderwolfEvents.emitSent({ messageId: '<x>', to: 'a@b.com', subject: 'X', elapsed: 0, attempt: 1 });

    assert(count === 0, `No listeners fired after removeAllListeners (got ${count})`);
}

// ============================================================================
// Test 8: DEFAULT_RETRY_OPTIONS shape
// ============================================================================
async function testDefaultOptions() {
    console.log('\n📋 Test 8: DEFAULT_RETRY_OPTIONS');

    assert(DEFAULT_RETRY_OPTIONS.maxRetries === 0, 'maxRetries defaults to 0');
    assert(DEFAULT_RETRY_OPTIONS.initialDelay === 1000, 'initialDelay defaults to 1000');
    assert(DEFAULT_RETRY_OPTIONS.backoffMultiplier === 2, 'backoffMultiplier defaults to 2');
    assert(DEFAULT_RETRY_OPTIONS.maxDelay === 30000, 'maxDelay defaults to 30000');
    assert(Array.isArray(DEFAULT_RETRY_OPTIONS.retryableErrors), 'retryableErrors is an array');
    assert(DEFAULT_RETRY_OPTIONS.retryableErrors.includes('ECONNRESET'), 'retryableErrors includes ECONNRESET');
}

// ============================================================================
// Test 9: sendEmail with retry config (will fail since no real SMTP, but tests integration)
// ============================================================================
async function testSendEmailIntegration() {
    console.log('\n📋 Test 9: sendEmail integration with retry + events');

    const events = [];
    const onSending = (data) => events.push({ type: 'sending', ...data });
    const onFailed = (data) => events.push({ type: 'failed', ...data });
    const onRetrying = (data) => events.push({ type: 'retrying', ...data });

    on('sending', onSending);
    on('failed', onFailed);
    on('retrying', onRetrying);

    const result = await sendEmail({
        smtp: {
            host: '127.0.0.1',
            port: 9999,      // Nothing listening here
            secure: false,
            auth: { user: 'test@test.com', pass: 'test' },
            usePool: false,
            connectionTimeout: 500,
        },
        mail: {
            to: 'recipient@example.com',
            subject: 'Retry Test',
            text: 'Testing retry',
        },
        retry: {
            maxRetries: 1,
            initialDelay: 100,
        },
    });

    assert(result.success === false, 'Send fails (no SMTP server)');
    assert(typeof result.error === 'string', 'Error message returned');
    assert(result.attempts === 2, `Made 2 attempts (got ${result.attempts})`);

    // Check events fired
    const sendingEvents = events.filter(e => e.type === 'sending');
    const failedEvents = events.filter(e => e.type === 'failed');
    const retryingEvents = events.filter(e => e.type === 'retrying');

    assert(sendingEvents.length >= 1, `At least 1 sending event fired (got ${sendingEvents.length})`);
    assert(failedEvents.length >= 1, `At least 1 failed event fired (got ${failedEvents.length})`);

    // Cleanup
    off('sending', onSending);
    off('failed', onFailed);
    off('retrying', onRetrying);
    removeAllListeners();
}

// ============================================================================
// Test 10: createMailer with on/off/once
// ============================================================================
async function testMailerEvents() {
    console.log('\n📋 Test 10: createMailer event methods');

    const mailer = createMailer({
        smtp: {
            host: '127.0.0.1',
            port: 9999,
            secure: false,
            auth: { user: 'test@test.com', pass: 'test' },
        },
        retry: { maxRetries: 0 },
    });

    assert(typeof mailer.on === 'function', 'mailer has on() method');
    assert(typeof mailer.off === 'function', 'mailer has off() method');
    assert(typeof mailer.once === 'function', 'mailer has once() method');

    // Test chaining
    const chainResult = mailer.on('sending', () => { });
    assert(chainResult === mailer, 'on() returns mailer for chaining');

    removeAllListeners();
}

// ============================================================================
// Test 11: Custom shouldRetry function
// ============================================================================
async function testCustomShouldRetry() {
    console.log('\n📋 Test 11: Custom shouldRetry function');

    let callCount = 0;

    try {
        await withRetry(
            async () => {
                callCount++;
                throw new Error('custom error XYZ');
            },
            {
                maxRetries: 3,
                initialDelay: 50,
                shouldRetry: (error) => error.message.includes('XYZ'),
            }
        );
        assert(false, 'Should have thrown');
    } catch (error) {
        assert(callCount === 4, `Custom shouldRetry allowed all retries (got ${callCount})`);
    }
}

// ============================================================================
// Run all tests
// ============================================================================
async function runTests() {
    console.log('🐺 Senderwolf Retry & Events Test Suite\n');
    console.log('='.repeat(50));

    await testRetrySuccess();
    await testRetryNonRetryable();
    await testRetryExhausted();
    await testRetryDisabled();
    await testEventEmitter();
    await testOnce();
    await testRemoveAll();
    await testDefaultOptions();
    await testSendEmailIntegration();
    await testMailerEvents();
    await testCustomShouldRetry();

    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

    if (failed > 0) {
        console.log('\n❌ Some tests failed!');
        process.exit(1);
    } else {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
