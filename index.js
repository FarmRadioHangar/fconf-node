console.error("==========================++++++++++++++============================");
var appConfig = require("./config.json");
var myLib = require("./myLib");

process.on("SIGUSR1", function () {
	myLib.consoleLog("debug", "=========", "SIGUSR1 received", "=========");
//	fconf.loadConfigFromDisk(appConfig.configStateDir);
	console.error("SIGUSR1 received, config was updated externaly");
});

process.on('uncaughtException', function (err) {
	console.error("EXCEPTION::" + err.stack);
	myLib.consoleLog("error", "uncaughtException", err.stack, err);
//	myLib.mailSend(appConfig.mailParams, 'uncaughtException on ' + new Date().toLocaleString(), err.stack, appConfig.adminEmail);
});

var fconf = require("./fconf");
var fdevice = require("./fdevice");
var websocket = require('./webSocketServer');

exports.wsBroadcast = websocket.startListener({ port: appConfig.webSocketPort });

