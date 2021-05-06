const https = require('https');
const { InitializeHeaders } = require('../util/InitializeHeaders');
const { EventEmitter } = require('events');
const { BASE_BUFFER } = require('../constants/Constants');
const FrameBuffer = require('../util/FrameBuffer');
const GKey = require('../util/GenerateKey');

class YenSocket extends EventEmitter {
    /**
     * Constructor for the YenSocket, requires a WS url to function in the constructor
     * @param {string} url
     * @param {object} options
     */
    constructor(url, options) {
        super(url, options);
        this.url = url;
        this.options = options || {};

        this.CONNECTING = 0;
        this.OPEN = 1;
        this.CLOSING = 2;
        this.CLOSED = 3;
        this.CONNECTION_STATE = this.CONNECTING;

        const initializeHeaders = new InitializeHeaders();
        this.request = https.request(initializeHeaders.parseHeaders(url));
        this.request.end();

        this.request.on('upgrade', (response, socket) => {
            // Check for websocket connection
            if (!response.headers["sec-websocket-accept"]) throw new Error("The sec-websocket-accept header is missing.");
            // Validation of the server key
            const expectedKey = GKey.generateExpectedKey("sha1", initializeHeaders.getGeneratedWSKey(), "base64");
            if (response.headers["sec-websocket-accept"] !== expectedKey) throw new Error("The sec-websocket-accept header returned a mismatched key.");

            validateHandshake(response.headers, initializeHeaders.getGeneratedWSKey());

            this.CONNECTION_STATE = this.OPEN;

            let state = this.CONNECTION_STATE;
            this.emit('open', ({ response, socket, state }));
            this.destroyed = socket.destroyed;

            let buffer = BASE_BUFFER;
            let framebuffer = null;
            FrameBuffer.decode(socket, buffer, framebuffer);

            socket.on('message', message => {
                this.emit("message", JSON.stringify(message));
            });

            this.socket = socket;
        });
    }

    /**
     * Sends data, designed for sending JSON payloads.
     * @param {string} data - Data should be sent in the form of a string so it can be buffered
     */
    send(data) {
        this.on('message', message => {
            let theMessage = JSON.parse(message);
            if (theMessage && theMessage.op === 10) {
                this.socket.write(FrameBuffer.generateMessage(data));
            }
        });
    }

    /**
     * Destroys the connection.
     */
    destroy() {
        this.on('open', ({ response, socket }) => {
            this.emit('close');
            return response.destroyed ? null : socket.destroy();
        });
    }

    /**
     * Cleanly closes the connection with a close frame
     * @param {number} code - Takes a valid WebSocket close code
     * @param {string} reason - Takes any reason as a string
     * @param {boolean} masked - Should be masked but this is optional in some cases
     */
    close(code = this.code || 1000, reason, masked = true) {
        this.on('open', ({ socket }) => {
            const close = FrameBuffer.closeFrame(code, reason || undefined, masked);
            socket.write(close);
        });
    }

    ping(data, masked = true) {
        this.on('open', ({ socket, state }) => {
            if (state === this.OPEN) {
                const ping = FrameBuffer.pingFrame(data, masked);
                socket.write(ping);
            }
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
    const expectedKey = GKey.generateExpectedKey("sha1", wsKey, "base64");
    if (key !== expectedKey) {
        throw new Error("The sec-websocket-accept header returned a mismatched key.");
    }

    return true;
}

module.exports = {
    YenSocket
};
