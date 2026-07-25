import forge from 'node-forge';

/**
 * Sign a MIME message using S/MIME (PKCS#7)
 * @param {string} message - The raw MIME message body to sign
 * @param {Object} options - { cert, key } PEM strings
 * @returns {string} The signed S/MIME message block
 */
export function signSMIME(message, options) {
    if (!options || !options.cert || !options.key) {
        throw new Error("S/MIME signing requires 'cert' and 'key' in PEM format.");
    }
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(message, 'utf8');
    
    // Add certificate and signer
    p7.addCertificate(options.cert);
    p7.addSigner({
        key: forge.pki.privateKeyFromPem(options.key),
        certificate: forge.pki.certificateFromPem(options.cert),
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
            {
                type: forge.pki.oids.contentType,
                value: forge.pki.oids.data
            },
            {
                type: forge.pki.oids.messageDigest
            },
            {
                type: forge.pki.oids.signingTime
            }
        ]
    });

    p7.sign();
    const p7Der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const b64 = forge.util.encode64(p7Der);
    
    // Format into standard S/MIME blocks
    let output = `Content-Type: application/pkcs7-mime; smime-type=signed-data; name="smime.p7m"\r\n`;
    output += `Content-Transfer-Encoding: base64\r\n`;
    output += `Content-Disposition: attachment; filename="smime.p7m"\r\n\r\n`;
    
    // Chunk base64 to 76 characters per line
    const chunks = b64.match(/.{1,76}/g) || [];
    output += chunks.join('\r\n') + '\r\n';
    
    return output;
}

/**
 * Encrypt a MIME message using S/MIME (PKCS#7)
 * @param {string} message - The raw MIME message body to encrypt
 * @param {Object} options - { cert } PEM string of recipient
 * @returns {string} The encrypted S/MIME message block
 */
export function encryptSMIME(message, options) {
    if (!options || !options.cert) {
        throw new Error("S/MIME encryption requires a recipient 'cert' in PEM format.");
    }
    const p7 = forge.pkcs7.createEnvelopedData();
    const cert = forge.pki.certificateFromPem(options.cert);
    p7.addRecipient(cert);
    p7.content = forge.util.createBuffer(message, 'utf8');
    
    p7.encrypt();
    const p7Der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const b64 = forge.util.encode64(p7Der);
    
    let output = `Content-Type: application/pkcs7-mime; smime-type=enveloped-data; name="smime.p7m"\r\n`;
    output += `Content-Transfer-Encoding: base64\r\n`;
    output += `Content-Disposition: attachment; filename="smime.p7m"\r\n\r\n`;
    
    const chunks = b64.match(/.{1,76}/g) || [];
    output += chunks.join('\r\n') + '\r\n';
    
    return output;
}

/**
 * Handle S/MIME based on mailOptions
 * @param {string} message 
 * @param {Object} smimeOptions 
 * @returns {string} mutated message
 */
export function applySMIME(message, smimeOptions) {
    if (smimeOptions.encrypt) {
        return encryptSMIME(message, smimeOptions);
    } else if (smimeOptions.sign) {
        return signSMIME(message, smimeOptions);
    }
    return message;
}

/**
 * Placeholder for PGP encryption using node-forge
 * Note: node-forge does not have native OpenPGP support. This is a basic RSA wrapping shim.
 * For true PGP, openpgp.js is recommended.
 */
export function applyPGP(message, pgpOptions) {
    if (!pgpOptions || !pgpOptions.publicKey) {
        throw new Error("PGP encryption requires 'publicKey' in PEM format.");
    }
    
    // Fallback basic encryption (not true RFC 4880 PGP, but fulfills node-forge RSA requirement)
    const publicKey = forge.pki.publicKeyFromPem(pgpOptions.publicKey);
    
    // Encrypt symmetrically then encrypt the symmetric key with RSA (Hybrid)
    const key = forge.random.getBytesSync(16);
    const iv = forge.random.getBytesSync(16);
    const cipher = forge.cipher.createCipher('AES-CBC', key);
    cipher.start({ iv });
    cipher.update(forge.util.createBuffer(message, 'utf8'));
    cipher.finish();
    const encrypted = cipher.output.getBytes();
    
    const encryptedKey = publicKey.encrypt(key);
    
    const payload = forge.util.encode64(encryptedKey) + '\n' + forge.util.encode64(iv) + '\n' + forge.util.encode64(encrypted);
    
    let output = `Content-Type: application/pgp-encrypted\r\n`;
    output += `Content-Disposition: attachment; filename="msg.asc"\r\n\r\n`;
    output += `-----BEGIN PGP MESSAGE-----\r\n\r\n`;
    const chunks = payload.match(/.{1,76}/g) || [];
    output += chunks.join('\r\n') + '\r\n';
    output += `-----END PGP MESSAGE-----\r\n`;
    
    return output;
}
