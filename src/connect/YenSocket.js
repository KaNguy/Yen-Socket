const https = require('https');
const { InitializeHeaders } = require('../util/InitializeHeaders');
const { EventEmitter } = require('events');
const { BASE_BUFFER } = require('../constants/Constants');
const { decode, generateMessage, closeFrame } = require('../util/FrameBuffer');
const { generateExpectedKey } = require('../util/GenerateKey');

class YenSocket extends EventEmitter {
    constructor(url, options) {
        super(url, options);
        this.url = url;
        this.options = options || {};

        const initializeHeaders = new InitializeHeaders();
        this.request = https.request(initializeHeaders.parseHeaders(url));
        this.request.end();

        this.request.on('upgrade', (response, socket) => {
            // Check for websocket connection
            if (!response.headers["sec-websocket-accept"]) throw new Error("The sec-websocket-accept header is missing.");
            // Validation of the server key
            const expectedKey = generateExpectedKey("sha1", initializeHeaders.getGeneratedWSKey(), "base64");
            if (response.headers["sec-websocket-accept"] !== expectedKey) throw new Error("The sec-websocket-accept header returned a mismatched key.");

            validateHandshake(response.headers, initializeHeaders.getGeneratedWSKey());

            this.emit('open', ({ response, socket }));
            this.destroyed = socket.destroyed;

            let buffer = BASE_BUFFER;
            let framebuffer = null;
            decode(socket, buffer, framebuffer);

            socket.on('message', message => {
                this.emit("message", JSON.stringify(message));
            });

            this.socket = socket;
        });
    }

    send(data) {
        this.on('message', message => {
            let theMessage = JSON.parse(message);
            if (theMessage && theMessage.op === 10) {
                this.socket.write(generateMessage(data));
            }
        });
    }

    // Destroys the connection, but may be lossy
    destroy() {
        this.on('open', ({ response, socket }) => {
            this.emit('close');
            return response.destroyed ? null : socket.destroy();
        });
    }

    // Closes the connection in a much cleaner & graceful manner
    close(code = this.code || 1000, reason, masked = true) {
        this.on('open', ({ socket }) => {
            const close = closeFrame(code, reason || undefined, masked);
            socket.write(close);
        });
    }
}

/**
 * Validates the incoming handshake and compares WebSocket keys
 * @param {IncomingHttpHeaders} handshake - Handshake from the return response
 * @param {string} wsKey - The WebSocket key
 * @returns {boolean} - Sole purpose is to validate the handshake, not return values, but it will return true if it is required for other checks
 */
const validateHandshake = function(handshake, wsKey) {
    let headers = handshake, key;

    if (handshake.length < 4) {
        throw new Error("Invalid handshake, the handshake was too small.");
    }

    if (!headers['upgrade'] || !headers['sec-websocket-accept'] || !headers['connection']) {
        throw new Error("Invalid handshake, required header(s) are missing.");
    }

    if (headers['upgrade']?.toLowerCase() !== "websocket" || headers['connection']?.toLowerCase().split(/\s*,\s*/).indexOf('upgrade') === -1) {
        throw new Error("Invalid handshake, invalid Upgrade/Connection header(s).");
    }

    // Validate the server key
    key = headers['sec-websocket-accept'];
    const expectedKey = generateExpectedKey("sha1", wsKey, "base64");
    if (key !== expectedKey) {
        throw new Error("The sec-websocket-accept header returned a mismatched key.");
    }

    return true;
}

module.exports = {
    YenSocket
};
