const { BASE_BUFFER } = require('../constants/Constants');

/**
 * Creates metadata for the frame
 * The payload may be changed if the frame is masked
 * @param {boolean} fin - Indicates this is the final fragment in a WebSocket message
 * @param {number} op - Defines interpretation of the payload data
 * @param {boolean} masked - Masking for payloads to avoid vulnerability attacks on network infrastructure
 * @param {Buffer} payload - Payload and heart of the data
 * @returns {Buffer}
 * @private
 */
function generateMeta(fin, op, masked, payload) {
    const length = payload.length;
    const meta = Buffer.alloc(
        2 + (length < 126 ? 0 : length < 65536 ? 2 : 8) + (masked ? 4 : 0)
    );
    meta[0] = (fin ? 128 : 0) + op;
    meta[1] = masked ? 128 : 0;
    let start = 2;
    if (length < 126) {
        meta[1] += length;
    } else if (length < 65536) {
        meta[1] += 126;
        meta.writeUInt16BE(length, 2);
        start += 2;
    } else {
        meta[1] += 127;
        meta.writeUInt32BE(Math.floor(length / Math.pow(2, 32)), 2);
        meta.writeUInt32BE(length % Math.pow(2, 32), 6);
        start += 8;
    }

    if (masked) {
        const mask = Buffer.alloc(4);
        //let i = 0;
        for (let i = 0; i < 4; i++) {
            meta[start + i] = mask[i] = Math.floor(Math.random() * 256);
        }
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
        }
        //start += 4;
    }
    return meta;
}

/**
 * Creates a frame that will cleanly close the connection
 * The reason is optional, masking the data will default to true
 * @param {number} code - Status code
 * @param {string} reason - Reason (optional)
 * @param {boolean} masked - Masking for payloads to avoid vulnerability attacks on network infrastructure
 * @returns {Buffer}
 */
function closeFrame(code, reason, masked) {
    let payload, meta;

    if (code !== undefined && code !== 1005) {
        payload = Buffer.from(reason === undefined ? '--' : '--' + reason)
        payload.writeUInt16BE(code, 0)
    } else {
        payload = Buffer.alloc(0)
    }
    meta = generateMeta(true, 0x08, masked === undefined ? false : masked, payload)

    return Buffer.concat([meta, payload], meta.length + payload.length)
}

function pingFrame(data, masked) {
    let payload, meta;

    payload = Buffer.from(data);
    meta = generateMeta(true, 0x9, masked === undefined ? false : masked, payload);

    return Buffer.concat([meta, payload], meta.length + payload.length);
}

/**
 * Generates a WebSocket message
 * @param {string} data - Data for sending payloads
 * @returns {Buffer}
 */
function generateMessage(data) {
    const payload = Buffer.from(data);
    const meta = generateMeta(true, 1, true, payload);
    return Buffer.concat([meta, payload], meta.length + payload.length);
}

/**
 * Event-based decoder than decodes incoming messages and emits them as events
 * @param {Socket} socket - Socket for listening to the event
 * @param {Buffer} buffer - Buffer that is allocated at 0
 * @param {any} frameBuffer - Null frame buffer used for emitting data
 */
function decode(socket, buffer, frameBuffer) {
    this.socket = socket;
    buffer = BASE_BUFFER;
    frameBuffer = null;
    this.socket.on('data', data => {
        buffer = Buffer.concat([buffer, data], buffer.length + data.length);

        if (buffer.length > 2) {
            const buf0 = buffer[0];
            const hb = buf0 >> 4;
            const fin = hb === 8;
            const opcode = buf0 % 16;

            const buf1 = buffer[1];
            const hasMask = buf1 >> 7;
            let length = buf1 % 128;
            let start = hasMask ? 6 : 2;
            if (buffer.length < start + length) return;
            if (length === 126) {
                length = buffer.readUInt16BE(2);
                start += 2;
            } else if (length === 127) {
                length =
                    buffer.readUInt32BE(2) * Math.pow(2, 32) + buffer.readUInt32BE(6);
                start += 8;
            }
            if (buffer.length < start + length) return;
            let payload = buffer.slice(start, start.length);
            if (hasMask) {
                const mask = buffer.slice(start - 4, start);
                for (let index = 0; index < payload.length; index++) {
                    payload[this.i] ^= mask[this.i % 4];
                }
            }
            buffer = buffer.slice(start + length);
            if (opcode === 1) {
                payload = payload.toString();
                frameBuffer = frameBuffer ? frameBuffer + payload : payload;
                if (fin) {
                    let message;
                    try {
                        message = JSON.parse(frameBuffer);
                    } catch {
                        message = frameBuffer;
                    }

                    this.socket.emit("message", message);
                    frameBuffer = null;
                }
            }
            if (opcode === 8) {
                if (payload.length >= 2) {
                    const code = payload.readUInt16BE(0);
                    const reason = payload.slice(2).toString();
                    console.log(`Connection closed, Opcode: ${opcode}`, `Code: ${code},`, `Reason: ${reason || "No reason"}`);
                } else {
                    const code = 1005;
                    console.log(`Connection closed, Opcode: ${opcode}`, `Code: ${code},`, `Reason: No reason`);
                }
            }
        }
    });
}

function decode1(buffer, data) {
    buffer = Buffer.concat([buffer, data], buffer.length + data.length);
    if (buffer.length > 2) {
        const buf0 = buffer[0];
        const hb = buf0 >> 4;
        const fin = hb === 8;
        const opcode = buf0 % 16;

        if (opcode !== 0 &&
            opcode !== 1 &&
            opcode !== 2 &&
            opcode !== 8 &&
            opcode !== 9 &&
            opcode !== 10) {
            return false;
        }

        if (opcode >= 8 && !fin) {
            return false;
        }

        const buf1 = buffer[1];
        const hasMask = buf1 >> 7;

        if (!hasMask) {
            return false;
        }

        let length = buf1 % 128;
        let start = hasMask ? 6 : 2;

        if (buffer.length < start + length) return false;

        if (length === 126) {
            length = buffer.readUInt16BE(2);
            start += 2;
        } else if (length === 127) {
            length = buffer.readUInt32BE(2) * Math.pow(2, 32) + buffer.readUInt32BE(6);
            start += 8;
        }

        if (buffer.length < start + length) return false;

        let payload = buffer.slice(start, start + length);
        let mask, i;
        if (hasMask) {
            mask = buffer.slice(start - 4, start);
            for (i = 0; i < payload.length; i++) {
                payload[i] ^= mask[i % 4];
            }
        }

        let frameBuffer = buffer.slice(start + length);
        //console.log(frameBuffer);
        //return frameBuffer;
    }
}

module.exports = {
    generateMessage,
    decode,
    closeFrame,
    pingFrame,
    decode1
}
