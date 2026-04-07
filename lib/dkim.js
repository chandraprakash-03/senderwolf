/**
 * DKIM (DomainKeys Identified Mail) signing implementation — RFC 6376
 * Uses only Node.js built-in `crypto` module — zero external dependencies.
 *
 * Canonicalization: relaxed/relaxed (most compatible)
 * Signature algorithm: rsa-sha256
 */

import { createSign, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Headers to sign by default (in order of priority — common interoperable set)
const DEFAULT_SIGNED_HEADERS = [
    'from',
    'to',
    'subject',
    'date',
    'message-id',
    'mime-version',
    'content-type',
    'cc',
];

/**
 * Relaxed body canonicalization (RFC 6376 §3.4.4)
 *  - Ignores empty lines at the end of the body
 *  - Reduces each sequence of whitespace within a line to a single SP
 *  - Removes trailing WSP on each line
 *  - Ensures exactly one CRLF at the end
 */
function relaxedBody(body) {
    // Normalize line endings to \r\n
    const normalised = body.replace(/\r?\n/g, '\r\n');

    // Split into lines (keep empty ones for now)
    const lines = normalised.split('\r\n');

    // Relax each line: trim trailing whitespace, collapse internal whitespace
    const relaxedLines = lines.map(line =>
        line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/, '')
    );

    // Strip empty lines from the end
    while (relaxedLines.length > 0 && relaxedLines[relaxedLines.length - 1] === '') {
        relaxedLines.pop();
    }

    // Canonical body must end with exactly one CRLF
    return relaxedLines.join('\r\n') + '\r\n';
}

/**
 * Relaxed header canonicalization for a single header (RFC 6376 §3.4.2)
 *  - Lowercases the header name
 *  - Unfolds the value (replaces CRLF + WSP with a single SP)
 *  - Collapses runs of whitespace to a single SP
 *  - Strips trailing whitespace from the value
 */
function relaxedHeader(name, value) {
    const canonName = name.toLowerCase().trim();
    const canonValue = value
        .replace(/\r\n[ \t]+/g, ' ')   // unfold
        .replace(/[ \t]+/g, ' ')        // collapse whitespace
        .trim();
    return `${canonName}:${canonValue}`;
}

/**
 * Extract all headers from a raw message string.
 * Returns a Map<lowerCaseName, lastValue> (last wins for duplicates).
 * Also returns them as an ordered array for canonicalization.
 */
function parseHeaders(headersSection) {
    // Unfold multi-line headers first
    const unfolded = headersSection.replace(/\r\n([ \t])/g, ' $1');
    const lines = unfolded.split('\r\n').filter(Boolean);

    const map = new Map();   // lowercase name → raw value
    const ordered = [];      // [{ name, value }]

    for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const name = line.substring(0, colon);
        const value = line.substring(colon + 1);
        const lower = name.toLowerCase();
        map.set(lower, { name, value });
        ordered.push({ name, value });
    }

    return { map, ordered };
}

/**
 * Split a raw email message into its header section and body.
 * Returns { headers: string, body: string }
 */
function splitMessage(message) {
    // Header/body separator is the first blank line (\r\n\r\n)
    const sep = message.indexOf('\r\n\r\n');
    if (sep === -1) {
        // No body
        return { headers: message, body: '' };
    }
    return {
        headers: message.substring(0, sep),
        body: message.substring(sep + 4), // skip the \r\n\r\n
    };
}

/**
 * Build the body hash (bh=) value.
 */
function computeBodyHash(body, hashAlgo = 'sha256') {
    const canonical = relaxedBody(body);
    return createHash(hashAlgo).update(canonical, 'binary').digest('base64');
}

/**
 * Build the canonicalized header string that will be signed.
 * Includes the DKIM-Signature header stub (with b= empty) at the end.
 */
function buildSigningHeaderData(headerMap, headersToSign, dkimStub) {
    const parts = [];

    for (const name of headersToSign) {
        const lower = name.toLowerCase();
        const entry = headerMap.get(lower);
        if (!entry) continue; // header not present — skip
        parts.push(relaxedHeader(entry.name, entry.value));
    }

    // Always append the DKIM-Signature stub last (RFC 6376 §3.7)
    parts.push(relaxedHeader('DKIM-Signature', dkimStub));

    return parts.join('\r\n');
}

/**
 * Load a private key either from a PEM string or a file path.
 */
function resolvePrivateKey(keyOrPath) {
    if (!keyOrPath) throw new Error('DKIM: privateKey is required');
    const trimmed = keyOrPath.trim();
    if (trimmed.startsWith('-----')) {
        return trimmed; // already PEM
    }
    // Treat as file path
    try {
        return readFileSync(trimmed, 'utf8');
    } catch (err) {
        throw new Error(`DKIM: could not read private key file "${trimmed}": ${err.message}`);
    }
}

/**
 * Sign a complete raw email message with DKIM.
 *
 * @param {string} message - The full raw email message (headers + \r\n\r\n + body).
 *                           Must NOT include the trailing DATA terminator (\r\n.\r\n).
 * @param {Object} dkimConfig
 * @param {string} dkimConfig.domainName - Signing domain (d=)
 * @param {string} dkimConfig.keySelector - DNS selector (s=)
 * @param {string} dkimConfig.privateKey  - RSA private key PEM or path to PEM file
 * @param {string[]} [dkimConfig.headerFields] - Headers to sign (default: from/to/subject/date/message-id/mime-version)
 * @param {string} [dkimConfig.hashAlgo='sha256'] - Hash algorithm
 * @returns {string} The message with the DKIM-Signature header prepended
 */
export function signMessage(message, dkimConfig) {
    if (!dkimConfig || !dkimConfig.domainName || !dkimConfig.keySelector || !dkimConfig.privateKey) {
        throw new Error('DKIM: domainName, keySelector and privateKey are all required');
    }

    const {
        domainName,
        keySelector,
        hashAlgo = 'sha256',
    } = dkimConfig;

    const privateKey = resolvePrivateKey(dkimConfig.privateKey);
    const { headers, body } = splitMessage(message);
    const { map: headerMap } = parseHeaders(headers);

    // Determine which headers to sign (filter to only those present)
    const requestedHeaders = (dkimConfig.headerFields || DEFAULT_SIGNED_HEADERS)
        .map(h => h.toLowerCase());
    const headersToSign = requestedHeaders.filter(h => headerMap.has(h));

    // Compute body hash
    const bodyHash = computeBodyHash(body, hashAlgo);

    // Build the DKIM-Signature stub (b= is intentionally empty)
    const timestamp = Math.floor(Date.now() / 1000);
    const headerList = headersToSign.join(':');

    const stub = [
        `v=1`,
        `a=rsa-${hashAlgo}`,
        `c=relaxed/relaxed`,
        `d=${domainName}`,
        `s=${keySelector}`,
        `t=${timestamp}`,
        `bh=${bodyHash}`,
        `h=${headerList}`,
        `b=`,
    ].join('; ');

    // Build the data to sign
    const signingData = buildSigningHeaderData(headerMap, headersToSign, stub);

    // Sign with RSA-SHA256
    const signer = createSign(`RSA-SHA${hashAlgo === 'sha256' ? '256' : '1'}`);
    signer.update(signingData, 'utf8');
    const signature = signer.sign(privateKey, 'base64');

    // Fold the signature value at 72 chars for MIME compliance
    const foldedSignature = signature.replace(/.{72}/g, '$&\r\n\t');

    // Build the final DKIM-Signature header (with real b= value)
    const dkimHeader = `DKIM-Signature: ${stub}${foldedSignature}`;

    // Prepend DKIM-Signature to the message
    return `${dkimHeader}\r\n${message}`;
}

/**
 * Utility: verify that a DKIM config object has the required fields.
 * Throws a descriptive error if not. Returns true if valid.
 */
export function validateDKIMConfig(dkim) {
    if (!dkim || typeof dkim !== 'object') {
        throw new Error('DKIM config must be an object');
    }
    if (!dkim.domainName || typeof dkim.domainName !== 'string') {
        throw new Error('DKIM: domainName must be a non-empty string');
    }
    if (!dkim.keySelector || typeof dkim.keySelector !== 'string') {
        throw new Error('DKIM: keySelector must be a non-empty string');
    }
    if (!dkim.privateKey || typeof dkim.privateKey !== 'string') {
        throw new Error('DKIM: privateKey must be a PEM string or a path to a PEM file');
    }
    return true;
}
