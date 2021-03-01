const https = require('https');
const { EventEmitter } = require('events');
const { CreateHeaders } = require('../util/CreateHeaders');
const { generateExpectedKey } = require('../util/GenerateKey');
const { decodeWebSocketFrame, generateMessage } = require('../util/FrameBuffer');
const { BASE_BUFFER } = require('../constants/Constants');
const generatedHeaders = new CreateHeaders();

class YenSocket extends EventEmitter {
    constructor(url, options = {}) {
        super(Object.assign(options || {}), url, options);
        this.url = url || "";
        this.options = options ? options : {};

        this.request = https.request(generatedHeaders.parseHeaders(this.url));
        this.request.end();
        // Validate the server key
        this.expectedKey = generateExpectedKey("sha1", generatedHeaders.generatedWSKey, "base64");

        // Initialize buffer
        let buffer = BASE_BUFFER;
        let framebuffer = null;

        this.request.on('upgrade', (response, socket, head) => {
            // Check if the server is willing to connect
            if (!response.headers["sec-websocket-accept"]) {
                throw new Error("Missing sec-websocket-accept Header");
            } if (response.headers["sec-websocket-accept"] !== this.expectedKey) {
                throw new Error("sec-websocket-accept Header returned a mismatched key");
            }

            // Get data
            socket.on("data", (data) => {
                //decodeWebSocketFrame(buffer, data, socket);
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
                            payload[i] ^= mask[i % 4];
                        }
                    }
                    buffer = buffer.slice(start + length);
                    if (opcode === 1) {
                        payload = payload.toString();
                        framebuffer = framebuffer ? framebuffer + payload : payload;
                        if (fin) {
                            // console.log(framebuffer);
                            socket.emit("message", JSON.parse(framebuffer));
                            framebuffer = null;
                        }
                    }
                    if (opcode === 8) {
                        if (payload.length >= 2) {
                            const code = payload.readUInt16BE(0);
                            const reason = payload.slice(2).toString();
                            console.log(`Close, Opcode ${opcode}`, code, reason);
                        }
                    }
                }
            });

            // Get parsed messages
            socket.on("message", (message) => {
                this.emit("message", JSON.parse(JSON.stringify(message)));
            });

            //this.emit('open', response, socket, head);
        });
    }

    // Sends data to websocket
    send(data) {
        if (!data) throw new Error("There was no data provided");
        this.request.on('upgrade', (response, socket, head) => {
            this.on("message", message => {
                if (message && message.op === 10) {
                    socket.write(generateMessage(data), console.error);
                }
            });
        });
    }
}

module.exports = YenSocket;