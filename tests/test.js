const { YenSocket } = require('../src/index');

const { token } = require('../config.json');
const payload = JSON.stringify({
    op: 2,
    d: {
        token: `Bot ${token}`,
        intents: 513,
        properties: {
            $os: "Linux",
            $browser: "Discord Desktop",
            $device: "PC",
        },
    },
});

const YS = new YenSocket('wss://gateway.discord.gg:443?v=8&encoding=json');

YS.on('open', () => {
    YS.send(payload);
});

YS.on('message', m => {
    const mes = JSON.parse(m);
    console.log(mes);
    // if (mes && mes.t) {
    //     console.log(mes.t);
    // }
});

//YS.close(1000, undefined, true);
//YS.close(1000);
