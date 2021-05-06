# Yen Socket
A sufficient implementation for WebSockets which can connect to `ws`/`wss` URLs, open connections, send data, and close those connections. This implementation is free of any external modules that require downloading or package managing. With this implementation relying on no external modules, this is light-weight and clients do not need to worry about other dependencies. 

## Overview
This implementation is mainly designed for sending JSON payloads and connecting to gateways that usually guarantee JSON data. This repository aims to make a decent to excellent implementation for interacting with WebSockets for simplicity.

## Author Notes
This repository could use a little more structuring and could be cleaned up so more attributes of the WebSocket interactions are more accessible and usable.

## Mini-Documentation
General example(s) for establishing and interacting with the WebSocket connection, code blocks may be a continuation of other previous code blocks.    
     
#### Creating the object of the class.
```js
const yenSocket = new YenSocket("wss://websocket-example-url.net/");
```       
     
#### Opening the connection   
```js
// Listen for open connection event
yenSocket.on("open", () => {
    console.log("Connection opened");
});
```    
    
#### Sending JSON data
```js
// Sending data when it connects
yenSocket.on("open", () => {
    yenSocket.send("<Your stringified JSON data in this argument>");
});

// Sending data anytime
yenSocket.send("<Your stringified JSON data in this argument>");
```


## Contributing
For full contribution guidelines, please read the [contribution guide](CONTRIBUTING.md). Thank you!

## License
[Apache 2.0](https://github.com/KaNguy/Yen-Socket/blob/main/LICENSE.md) License
