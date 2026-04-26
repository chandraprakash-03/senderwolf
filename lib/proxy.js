import * as net from "node:net";
import { ConnectionError } from "./errors.js";

/**
 * Connects to a proxy and performs the handshake to establish a tunnel.
 * Currently supports SOCKS5 (No Auth) and HTTP CONNECT.
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

async function performSocks5Handshake(socket, config, targetHost, targetPort) {
    return new Promise((resolve, reject) => {
        // 1. Greeting
        const greeting = Buffer.from([0x05, 0x01, 0x00]);
        socket.write(greeting);

        socket.once('data', (chunk) => {
            if (chunk[0] !== 0x05 || chunk[1] !== 0x00) {
                return reject(new ConnectionError('SOCKS5 Greeting failed or requires authentication'));
            }

            // 2. Connect Request
            const hostBuffer = Buffer.from(targetHost);
            const request = Buffer.alloc(7 + hostBuffer.length);
            request[0] = 0x05; // Version 5
            request[1] = 0x01; // Command: Connect
            request[2] = 0x00; // Reserved
            request[3] = 0x03; // Address Type: Domain Name
            request[4] = hostBuffer.length;
            hostBuffer.copy(request, 5);
            request.writeUInt16BE(targetPort, 5 + hostBuffer.length);

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
