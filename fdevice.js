var appConfig = require('./config.json');
var WebSocketClient = require('websocket').client;
var client = new WebSocketClient();
var wss = require('./webSocketServer');
var s = require('./applicationState');

var atiParse = function(ati) {
	return ati;
};

client.on('connectFailed', function(error) {
	//console.log('Connect Error: ' + error.toString());
	setTimeout(function() {
		client.connect(appConfig.fdevicesUrl);
	}, 10000);
});

client.on('connect', function(connection) {
	console.log('WebSocket Client Connected');
	connection.on('error', function(error) {
		console.log("Connection Error: " + error.toString());
	});
	connection.on('close', function() {
		console.log('echo-protocol Connection Closed');
		setTimeout(function() {
			client.connect(appConfig.fdevicesUrl);
		}, 10000);
	});

	connection.on('message', function(message) {
		if (message.type === 'utf8') {
			var incomingData = JSON.parse(message.utf8Data);
			console.log("Initial state: ", s.fconf);
			console.log("Received from fdevices: ", incomingData);
			//wss.broadcast(message.utf8Data);
			if (Array.isArray(incomingData)) {
				s.fdevices.clear();
				var outEvent = { interfaceUpdate: {} };
				incomingData.forEach(function(item) {
					let itemKey = item.imsi ? item.imsi : item.imei
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
				});
			} else {
				let item = incomingData.data;
				let itemKey = item.imsi ? item.imsi : item.imei
				switch (incomingData.name) {
					case "add":
					case "update":
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
						break;
					case "remove":
						s.fdevices.delete(itemKey);
						s.updateInterfaces();
						wss.broadcast(JSON.stringify({
							interfaceUpdate: { [itemKey]: s.interfaces[itemKey] ? s.interfaces[itemKey] : null }
						}));
						break;
					default:
						console.log('ivalid object received from fdevices', incomingData);
						return;
				}
			}
		}
//console.log('state:', s.fconf);
	});
/*
	function sendNumber() {
		if (connection.connected) {
			var number = Math.round(Math.random() * 0xFFFFFF);
			connection.sendUTF(number.toString());
			setTimeout(sendNumber, 1000);
		}
	}
	sendNumber();
*/
});

if (appConfig.fdevicesUrl) {
	client.connect(appConfig.fdevicesUrl);
}
