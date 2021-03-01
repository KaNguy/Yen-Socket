const YenSocket = require('../src/connect/YenSocket');
const yenSocket = new YenSocket("wss://gateway.discord.gg:443?v=8&encoding=json");
const { token } = require('../config.json');

const payload = JSON.stringify({
        op: 2,
        d: {
            token: `Bot ${token}`,
            intents: 513,
            properties: {
                $os: "Desktop",
                $browser: "Desktop",
                $device: "Desktop",
            },
        },
    });



const heartbeat = async () => {
    const theData = JSON.stringify({ op: 1, d: null });
    yenSocket.send(theData);
};

yenSocket.on('message', message => {
    console.log(message);
    heartbeat().then(() =>
        setInterval(heartbeat, message.d.heartbeat_interval)
    );
});

yenSocket.send(payload);
