// NOTE: This function needs some fixing since it seems to decode incoming data poorly when it is called and only decodes roughly half the data.
function decodeWebSocketFrame(buffer, data, socket) {
    let framebuffer = null;
    buffer = Buffer.concat([buffer, data], buffer.length + data.length);

    if (buffer.length > 2) {
        // buf0
        const buf0 = buffer[0];
        const hb = buf0 >> 4;
        const fin = hb === 8;
        const opcode = buf0 % 16;

        // buf1
        const buf1 = buffer[1];
        const hasMask = buf1 >> 7;
        let length = buf1 % 128;
        let start = hasMask ? 6 : 2;
        if (buffer.length < start + length) return;
        if (length === 126) {
            length = buffer.readUInt16BE(2);
            start += 2;
        } else if (length === 127) {
            length = buffer.readUInt32BE(2) * Math.pow(2, 32) + buffer.readUInt32BE(6);
            start += 8;
        }
        if (buffer.length < start + length) return;
        let payload = buffer.slice(start, start.length);
        if (hasMask) {
            const mask = buffer.slice(start - 4, start);
            for (let index = 0; index < payload.length; index++) {
                payload['i'] ^= mask['i' % 4];
            }
        }
        buffer = buffer.slice(start + length);
        if (opcode === 1) {
            payload = payload.toString();
            framebuffer = framebuffer ? framebuffer + payload : payload;
            if (fin) {
                socket.emit("message", JSON.parse(framebuffer));
                framebuffer = null;
            }
        }
        if (opcode === 8) {
            if (payload.length >= 2) {
                const code = payload.readUInt16BE(0);
                const reason = payload.slice(2).toString();
                console.log(`Close ${opcode}`, code, reason);
            }
        }
    }
}

function generateMeta(fin, op, masked, payload) {
    // Generates meta based on the op
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
        let i = 0;
        for (i = 0; i < 4; i++) {
            meta[start + i] = mask[i] = Math.floor(Math.random() * 256);
        }
        for (i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
        }
        start += 4;
    }
    return meta;
}

function generateMessage(data) {
    const payload = Buffer.from(data);
    const meta = generateMeta(true, 1, true, payload);
    return Buffer.concat([meta, payload], meta.length + payload.length);
}

module.exports = {
    decodeWebSocketFrame,
    generateMeta,
    generateMessage
}