import { promises as dns } from "node:dns";
import { ValidationError } from "./errors.js";

/** Default timeout for individual DNS lookups in ms */
const DNS_LOOKUP_TIMEOUT = 10000;

/**
 * Wrap a promise with a timeout to prevent indefinite hangs on DNS lookups (W5 fix)
 */
function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise.then(
            (result) => { clearTimeout(timer); return result; },
            (err) => { clearTimeout(timer); throw err; }
        ),
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`DNS lookup timed out after ${ms}ms for ${label}`)), ms);
        }),
    ]);
}

/**
 * Validates the recipient's domain by checking for MX (Mail Exchange) records.
 * Falls back to A/AAAA records if no MX records are found (RFC 5321).
 * 
 * @param {string} emailOrDomain - The email address or domain to validate.
 * @param {number} [timeout=10000] - Timeout in ms for each DNS lookup.
 * @returns {Promise<{valid: boolean, records?: any[], domain: string, error?: string}>}
 */
export async function verifyMX(emailOrDomain, timeout = DNS_LOOKUP_TIMEOUT) {
    let domain = emailOrDomain;
    if (emailOrDomain.includes("@")) {
        domain = emailOrDomain.split("@").pop();
    }

    try {
        // 1. Try to resolve MX records
        const mxRecords = await withTimeout(dns.resolveMx(domain), timeout, domain);
        if (mxRecords && mxRecords.length > 0) {
            return {
                valid: true,
                records: mxRecords.sort((a, b) => a.priority - b.priority),
                domain
            };
        }
    } catch (error) {
        // MX record not found or DNS error
        if (error.code !== 'ENODATA' && error.code !== 'ENOTFOUND') {
            return {
                valid: false,
                error: error.code || error.message,
                domain
            };
        }
    }

    // 2. Fallback: Check for A records (RFC 5321 section 5.1 allows fallback to A records if MX is absent)
    try {
        const aRecords = await withTimeout(dns.resolve4(domain), timeout, domain);
        if (aRecords && aRecords.length > 0) {
            return {
                valid: true,
                records: [{ exchange: domain, priority: 0 }],
                domain,
                fallback: true
            };
        }
    } catch (error) {
        // No A records either
    }

    // 3. Fallback: Check for AAAA records
    try {
        const aaaaRecords = await withTimeout(dns.resolve6(domain), timeout, domain);
        if (aaaaRecords && aaaaRecords.length > 0) {
            return {
                valid: true,
                records: [{ exchange: domain, priority: 0 }],
                domain,
                fallback: true
            };
        }
    } catch (error) {
        // No AAAA records either
    }

    return {
        valid: false,
        error: "No MX, A, or AAAA records found",
        domain
    };
}

/**
 * Validates multiple email addresses for MX records.
 * 
 * @param {string|string[]} emails - Email address or array of email addresses.
 * @param {number} [timeout=10000] - Timeout in ms for each DNS lookup.
 * @throws {ValidationError} If any domain is invalid.
 */
export async function validateRecipientsMX(emails, timeout = DNS_LOOKUP_TIMEOUT) {
    const list = Array.isArray(emails) ? emails : [emails];
    const uniqueDomains = new Set();
    
    for (const email of list) {
        if (email.includes("@")) {
            uniqueDomains.add(email.split("@").pop());
        } else {
            uniqueDomains.add(email);
        }
    }

    const results = await Promise.all(
        Array.from(uniqueDomains).map(domain => verifyMX(domain, timeout))
    );

    const invalid = results.filter(r => !r.valid);
    if (invalid.length > 0) {
        const domains = invalid.map(i => i.domain).join(", ");
        throw new ValidationError(`Domain validation failed for: ${domains}. No mail servers found.`);
    }

    return results;
}
