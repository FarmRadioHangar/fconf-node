var appConfig = require('./config.json');
var client = require('./wsClient').client;

client.connect(appConfig.fdevicesUrl);
