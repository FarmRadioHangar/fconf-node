var appConfig = require('./config.json');
var WebSocketClient = require('websocket').client;
var client = new WebSocketClient();
var wss = require('./webSocketServer');

client.on('connectFailed', function(error) {
	console.log('Connect Error: ' + error.toString());
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
			console.log("Received from fdevices: ", incomingData);
			//wss.broadcast(message.utf8Data);
			if (Array.isArray(incomingData)) {
				var outEvent = { interfaceUpdate: {} };
				incomingData.forEach(function(key){
					outEvent.interfaceUpdate[key.imei] = {
						type: "3g",
						enabled: false,
						status: {}
					};
				});
				wss.broadcast(JSON.stringify(outEvent));
			} else {
				switch (incomingData.name) {
					case "add":
					case "update":
						wss.broadcast(JSON.stringify({
							interfaceUpdate: {
								[incomingData.data.imei]: {
									type: "3g",
									enabled: false,
									status: {}
								}
							}
						}));
						break;
					case "remove":
						wss.broadcast(JSON.stringify({
							interfaceUpdate: {
								[incomingData.data.imei]: null
							}
						}));
						break;
					default:
						console.log('ivalid object received from fdevices');
				}
			}
		}
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
