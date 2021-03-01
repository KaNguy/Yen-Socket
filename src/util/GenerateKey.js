const crypto = require('crypto');
const { GUID } = require('../constants/Constants');

function generateSecWebSocketKey(size, encoding) {
    return crypto.randomBytes(size || 16).toString(encoding || "base64");
}

function generateExpectedKey(algorithm, SecWebSocketKey, encoding) {
    return crypto
        .createHash(algorithm || "sha1")
        .update(`${SecWebSocketKey || generateSecWebSocketKey()}${GUID}`)
        .digest(encoding|| "base64");
}

module.exports = {
    generateSecWebSocketKey,
    generateExpectedKey
};