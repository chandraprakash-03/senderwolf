import * as net from "node:net";
import { ConnectionError } from "./errors.js";

/**
 * Connects to a proxy and performs the handshake to establish a tunnel.
 * Supports SOCKS5 (No Auth) and HTTP CONNECT.
 */
export async function createProxySocket(proxyConfig, targetHost, targetPort, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const socket = net.connect({
            host: proxyConfig.host,
            port: proxyConfig.port
        });

        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new ConnectionError(`Proxy connection failed: Connection timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        socket.once('error', (err) => {
            clearTimeout(timeout);
            reject(new ConnectionError(`Proxy connection failed: ${err.message}`));
        });

        socket.once('connect', async () => {
            try {
                if (proxyConfig.type === 'http') {
                    await performHttpHandshake(socket, proxyConfig, targetHost, targetPort);
                } else if (proxyConfig.type === 'socks5' || !proxyConfig.type) {
                    await performSocks5Handshake(socket, proxyConfig, targetHost, targetPort);
                } else {
                    throw new ConnectionError(`Unsupported proxy type: ${proxyConfig.type}`);
                }
                clearTimeout(timeout);
                resolve(socket);
            } catch (err) {
                clearTimeout(timeout);
                socket.destroy();
                reject(err);
            }
        });
    });
}

/**
 * Detect if a string is an IPv4 address
 */
function isIPv4(host) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

/**
 * Detect if a string is an IPv6 address
 */
function isIPv6(host) {
    return host.includes(':');
}

async function performSocks5Handshake(socket, config, targetHost, targetPort) {
    return new Promise((resolve, reject) => {
        // 1. Greeting
        const greeting = Buffer.from([0x05, 0x01, 0x00]);
        socket.write(greeting);

        socket.once('data', (chunk) => {
            if (chunk[0] !== 0x05 || chunk[1] !== 0x00) {
                return reject(new ConnectionError('SOCKS5 Greeting failed or requires authentication'));
            }

            // 2. Connect Request — handle IPv4, IPv6, and domain address types (W4 fix)
            let request;

            if (isIPv4(targetHost)) {
                // Address Type 0x01: IPv4
                const parts = targetHost.split('.').map(Number);
                request = Buffer.alloc(10);
                request[0] = 0x05; // Version 5
                request[1] = 0x01; // Command: Connect
                request[2] = 0x00; // Reserved
                request[3] = 0x01; // Address Type: IPv4
                request[4] = parts[0];
                request[5] = parts[1];
                request[6] = parts[2];
                request[7] = parts[3];
                request.writeUInt16BE(targetPort, 8);
            } else if (isIPv6(targetHost)) {
                // Address Type 0x04: IPv6
                // Parse the IPv6 address into 16 bytes
                const ipv6Bytes = parseIPv6(targetHost);
                request = Buffer.alloc(22);
                request[0] = 0x05; // Version 5
                request[1] = 0x01; // Command: Connect
                request[2] = 0x00; // Reserved
                request[3] = 0x04; // Address Type: IPv6
                ipv6Bytes.copy(request, 4);
                request.writeUInt16BE(targetPort, 20);
            } else {
                // Address Type 0x03: Domain Name
                const hostBuffer = Buffer.from(targetHost);
                request = Buffer.alloc(7 + hostBuffer.length);
                request[0] = 0x05; // Version 5
                request[1] = 0x01; // Command: Connect
                request[2] = 0x00; // Reserved
                request[3] = 0x03; // Address Type: Domain Name
                request[4] = hostBuffer.length;
                hostBuffer.copy(request, 5);
                request.writeUInt16BE(targetPort, 5 + hostBuffer.length);
            }

            socket.write(request);

            socket.once('data', (res) => {
                if (res[0] !== 0x05 || res[1] !== 0x00) {
                    return reject(new ConnectionError(`SOCKS5 Connect failed with code: ${res[1]}`));
                }
                resolve();
            });
        });
    });
}

/**
 * Parse an IPv6 address string into a 16-byte Buffer
 */
function parseIPv6(addr) {
    // Remove surrounding brackets if present
    addr = addr.replace(/^\[|\]$/g, '');

    // Expand :: shorthand
    const halves = addr.split('::');
    let groups;

    if (halves.length === 2) {
        const left = halves[0] ? halves[0].split(':') : [];
        const right = halves[1] ? halves[1].split(':') : [];
        const missing = 8 - left.length - right.length;
        const middle = new Array(missing).fill('0');
        groups = [...left, ...middle, ...right];
    } else {
        groups = addr.split(':');
    }

    const buf = Buffer.alloc(16);
    for (let i = 0; i < 8; i++) {
        const val = parseInt(groups[i] || '0', 16);
        buf.writeUInt16BE(val, i * 2);
    }
    return buf;
}

async function performHttpHandshake(socket, config, targetHost, targetPort) {
    return new Promise((resolve, reject) => {
        let request = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n`;
        request += `Host: ${targetHost}:${targetPort}\r\n`;
        
        if (config.auth) {
            const auth = Buffer.from(`${config.auth.user}:${config.auth.pass}`).toString('base64');
            request += `Proxy-Authorization: Basic ${auth}\r\n`;
        }
        
        request += '\r\n';
        socket.write(request);

        socket.once('data', (chunk) => {
            const response = chunk.toString();
            if (response.includes('200 Connection Established') || response.includes('200 OK')) {
                resolve();
            } else {
                reject(new ConnectionError(`HTTP Proxy Connect failed: ${response.split('\r\n')[0]}`));
            }
        });
    });
}
