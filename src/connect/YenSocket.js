const https = require('https');
const { InitializeHeaders } = require('../util/InitializeHeaders');
const { EventEmitter } = require('events');
const { BASE_BUFFER } = require('../constants/Constants');
const { decode, generateMessage } = require('../util/FrameBuffer');

class YenSocket extends EventEmitter {
    constructor(url, options) {
        super(url, options);
        this.url = url;
        this.options = options || {};

        this.request = https.request(new InitializeHeaders().parseHeaders(url));
        this.request.end();

        this.request.on('upgrade', (response, socket) => {
            this.emit('open');

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
}

module.exports = {
    YenSocket
};