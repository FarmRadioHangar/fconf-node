var appConfig = require('./config.json');
var WebSocketClient = require('websocket').client;
var client = new WebSocketClient();
var wss = require('./webSocketServer');
var s = require('./applicationState');

var atiParse = function(ati) {
	// parse response from modem ATI command
	// remove command echo and result, leaving only response
	let modemInfo = ati.split("\r\n\r\n")[0];
	if (modemInfo.substring(0,3) === 'ATI') {
		return modemInfo.split("\r\r\n")[1];
	}
	return modemInfo;
};

var dongleUpdate = function (item) {
	let itemKey = item.imsi ? item.imsi : item.imei;
	s.fdevices.set(itemKey, {
		imei: item.imei,
		imsi: item.imsi,
		tty: item.path,
		modem: atiParse(item.ati)
	});
	s.updateInterfaces();
	wss.broadcast(JSON.stringify({
		interfaceUpdate: {
			[itemKey]: s.interfaces[itemKey]
		}
	}));
};

client.on('connectFailed', (error) => {
	console.log('Connect Error: ' + error.toString());
	setTimeout(() => {
		client.connect(appConfig.fdevicesUrl);
	}, 10000);
});

client.on('connect', (connection) => {
	console.log('WebSocket Client Connected');
	connection.on('error', (error) => {
		console.log("Connection Error: " + error.toString());
	});
	connection.on('close', () => {
		console.log('echo-protocol Connection Closed');
		setTimeout(() => {
			client.connect(appConfig.fdevicesUrl);
		}, 10000);
	});

	connection.on('message', (message) => {
		if (message.type === 'utf8') {
			let incomingData = JSON.parse(message.utf8Data);
			console.log("Received from fdevices: ", incomingData);
			// array gives currently detected dongles in the system.
			if (Array.isArray(incomingData)) {
				s.fdevices.clear();
				incomingData.forEach(dongleUpdate);
			} else {
				let item = incomingData.data;
				switch (incomingData.name) {
					case "add":
					case "update":
						dongleUpdate(item);
						break;
					case "remove":
						let itemKey = item.imsi ? item.imsi : item.imei;
						s.fdevices.delete(itemKey);
						s.updateInterfaces();
						wss.broadcast(JSON.stringify({
							interfaceUpdate: { [itemKey]: s.interfaces[itemKey] ? s.interfaces[itemKey] : null }
						}));
						break;
					default:
						console.error('ivalid object received from fdevices', incomingData);
						return;
				}
			}
		}
	});
});

if (appConfig.fdevicesUrl) {
	client.connect(appConfig.fdevicesUrl);
}
