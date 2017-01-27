console.error("==========================++++++++++++++============================");
var appConfig = require("./config.json");
var myLib = require("./myLib");

process.on("SIGUSR1", function () {
	myLib.consoleLog("debug", "=========", "SIGUSR1 received", "=========");
	s.loadConfigFromDisk(appConfig.configStateDir);
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

/*
// rest server
var http = require("http");
var webHandlers = {
	fconf: fconf
};
var router = require("./router");

function startRest(route, webHandlers) {
	function onApiRequest(request, response) {
		route(webHandlers, request, response, true);
	}
	http.createServer(onApiRequest).listen(appConfig.restPort).setTimeout(55000);
}

startRest(router.route, webHandlers);
*/
