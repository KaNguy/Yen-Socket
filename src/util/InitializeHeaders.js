const { URL } = require('url');
const { generateSecWebSocketKey } = require('../util/GenerateKey');

class InitializeHeaders {
    constructor(options = {}) {
        if (options) this.options = options;
        this.options.URL = options.URL ? options.URL : null;


        this.generatedWSKey = generateSecWebSocketKey(16, "base64");
    }

    parseHeaders(url = this.options.URL) {
        const theURL = new URL(String(url));
        const headers = {
            Host: `${theURL.host}:${theURL.port || 443}`,
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Key": this.generatedWSKey,
            "Sec-WebSocket-Version": "13"
        };

        return {
            agent: false,
            hostname: theURL.hostname,
            port: theURL.port || 443,
            method: "GET",
            path: `${theURL.pathname}${theURL.search}`,
            headers
        };
    }

    getGeneratedWSKey() {
        return this.generatedWSKey;
    }
}

module.exports = {
    InitializeHeaders: InitializeHeaders
};
