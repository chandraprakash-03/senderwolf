import { PassThrough } from "node:stream";

export class StreamTransport {
    constructor(options) {
        this.name = 'StreamTransport';
        this.options = options || {};
    }

    async send(mailOptions, buildMimeFn) {
        return new Promise(async (resolve, reject) => {
            try {
                // Determine whether to stream part by part or generate the full message
                const stream = new PassThrough();
                
                // Start a background process to write to the stream
                setImmediate(async () => {
                    try {
                        const { parts, messageId } = await buildMimeFn(mailOptions);
                        
                        for (const part of parts) {
                            if (typeof part === 'string') {
                                stream.write(part);
                            } else if (part.type === 'stream') {
                                // Pipe readable stream into our pass-through stream
                                for await (const chunk of part.stream) {
                                    stream.write(chunk);
                                }
                            }
                        }
                        stream.end();
                    } catch (err) {
                        stream.destroy(err);
                    }
                });

                // In Stream transport, the response object contains the stream
                resolve({
                    messageId: mailOptions.messageId || `stream-${Date.now()}`,
                    stream,
                    transport: 'stream'
                });
            } catch (err) {
                reject(err);
            }
        });
    }
}

export class JSONTransport {
    constructor(options) {
        this.name = 'JSONTransport';
        this.options = options || {};
    }

    async send(mailOptions, buildMimeFn) {
        return new Promise((resolve) => {
            // We just return a representation of the message
            // Wait, we can serialize the mailOptions
            // For streams in attachments, we cannot easily serialize them to JSON unless we read them
            // We will just return the mailOptions but scrub the streams
            
            const scrubbedMailOptions = { ...mailOptions };
            if (scrubbedMailOptions.attachments) {
                scrubbedMailOptions.attachments = scrubbedMailOptions.attachments.map(att => {
                    if (att.content && typeof att.content.read === 'function') {
                        return { ...att, content: '[Stream]' };
                    }
                    if (Buffer.isBuffer(att.content)) {
                        return { ...att, content: '[Buffer]' };
                    }
                    return att;
                });
            }

            resolve({
                messageId: mailOptions.messageId || `json-${Date.now()}`,
                message: scrubbedMailOptions,
                transport: 'json'
            });
        });
    }
}
