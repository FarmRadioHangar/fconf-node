var WebSocketServer = require('ws').Server;
var fconf = require('./fconf');
var myLib = require('./myLib');

WebSocketServer.prototype.broadcast = function (data) {
	this.clients.forEach(function each(client) {
		client.send(data);
	});
};

var uiListener;
exports.startListener = function(options) {
	uiListener = new WebSocketServer(options);
	uiListener.on('connection', function connection(ws) {
		//var location = url.parse(ws.upgradeReq.url, true);

		var logTags = {
			module: 'websocket',
			remoteIp: ws.upgradeReq.headers['x-forwarded-for'] || ws.upgradeReq.headers["x-real-ip"] || ws.upgradeReq.remoteAddress
		};

		ws.on('error', function(err) {
			myLib.consoleLog(logTags, 'error', 'websocket::connection_error', err, ws.upgradeReq.url);
		});

		ws.on('close', function () {
			// todo: stop watching files if this was the last connected websocket client
			if (uiListener.clients.length === 0) {
			}
		});

		// todo: load state from disk and start watching files if this is the first connected websocket client
		fconf.getCurrentState(null, function(err, currentState) {
			ws.send(JSON.stringify(currentState));
		});

		ws.on('message', function incoming(message) {
			var parsed = false;
			try {
				parsed = JSON.parse(message);
			} catch (e) {
				var exception = {
					info: 'JSON.parse error',
					e: e.name + ": " + e.message,
					data: message
				};
				myLib.consoleLog(logTags, 'error', 'incoming message', exception, ws.upgradeReq.url);
				ws.send(JSON.stringify({ exception: exception }));
				ws.close();
			}
			if (parsed) {
				Object.keys(parsed).forEach(function(key) {
					if (typeof fconf[key] !== 'function') {
						myLib.consoleLog(logTags, 'error', 'invalid incoming object', parsed, ws.upgradeReq.url);
					} else {
						myLib.consoleLog(logTags, 'ws-in', '<<<<==', key, parsed[key]);
						fconf[key](parsed[key], function(err, data) {
							if (!err && data) {
								uiListener.broadcast(JSON.stringify(data));
							}
						});
					}
				});
			}
		});
	});
	return uiListener.broadcast;
}

exports.broadcast = function(data) {
	if (uiListener) {
		uiListener.broadcast(data);
	}
};
