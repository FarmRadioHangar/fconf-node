var fs = require("fs");
var child_process = require('child_process');
var appConfig = require("./config.json");
var s = require("./applicationState");
var myLib = require("./myLib");

// the response parameter of the exported functions can be httpResponse object or callback function

exports.updateWiFi = function (params, response) {
	console.error('params:', params);
	if (!myLib.checkObjectProperties(params, ['name', 'mode'])) {
		handleFailure(response, "invalid input");
		return;
	}
	var args = [];
	if (params.mode === 'client') {
		args.unshift('wifi-client');
	} else if (params.mode === 'ap') {
		args.unshift('access-point');
	} else {
		handleFailure(response, "invalid input");
		return;
	}

	if (params.enabled) {
		if (s.fconf[params.name] && s.fconf[params.name].enabled) {
			// if changing mode, first disable existing interface
			if (s.fconf[params.name].mode !== params.mode) {
				args.push('--enable');
				var args_d = [params.mode === 'ap' ? 'wifi-client' : 'access-point', '--disable'];
				var result = child_process.spawnSync(appConfig.fconfPath, args_d);
				if (result.status) {
					handleFailure(response, result.error.toString());
					return;
				}
			}
		} else {
			args.push('--enable');
		}
	} else if (s.fconf[params.name] && s.fconf[params.name].enabled) {
		args.push('--disable');
		// todo: handle special case when both config and disable should be applied, passing both to binary will fail
	}

	if (params.config) {
		args.push('--config=stdin');
	}
	fconfExec(args, params.config, (error) => {
		if (error) {
			handleFailure(response, error);
		} else {
			var responseData = { interfaceUpdate: {} };
			responseData.interfaceUpdate[params.name] = s.fconf[params.name];
			if (typeof response === 'function') {
				response(null, responseData);
			} else {
				myLib.httpGeneric(200, responseData, response);
			}
		}
	});
};

exports.updateEthernet = function (params, response) {
	console.error('params:', params);
	if (!myLib.checkObjectProperties(params, ['name'])) {
		handleFailure(response, "invalid input");
		return;
	}
	var args = ['ethernet'];

	if (params.enabled) {
		if (s.fconf[params.name] && s.fconf[params.name].enabled) {
		} else {
			args.push('--enable');
		}
	} else if (s.fconf[params.name] && s.fconf[params.name].enabled) {
		args.push('--disable');
		// todo: handle special case when both config and disable should be applied, passing both to binary will fail
	}

	if (params.config) {
		args.push('--config=stdin');
	}
	fconfExec(args, params.config, (error) => {
		if (error) {
			handleFailure(response, error);
		} else {
			var responseData = { interfaceUpdate: {} };
			responseData.interfaceUpdate[params.name] = s.fconf[params.name];
			if (typeof response === 'function') {
				response(null, responseData);
			} else {
				myLib.httpGeneric(200, responseData, response);
			}
		}
	});

};

exports.update3g = function (params, response) {

};

exports.update4g = function (params, response) {

};

exports.getCurrentState = function (params, response) {
	if (typeof response === 'function') {
		response(null, { interfaceInit: s.fconf });
	} else {
		myLib.httpGeneric(200, JSON.stringify(s.fconf), response, "DEBUG::getCurrentState");
	}
};

var handleFailure = function (response, error) {
	if (typeof response === 'function') {
		response(error);
	} else {
		myLib.httpGeneric(512, error, response);
	}
};

var fconfExec = function(args, config, cb) {
		var fconf = child_process.spawn(appConfig.fconfPath, args);
		if (config) {
			fconf.stdin.write(JSON.stringify(config) + "\n");
		}
		fconf.on('close', (code) => {
			if (code !== 0) {
				console.log(`fconf process exited with code ${code}`);
				cb(code);
			} else {
				loadConfigFromDisk();
				cb();
			}
		});
		fconf.on('error', (err) => {
			console.log(`Failed to start child process. ${err}`);
		});

		//debug
		fconf.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});
		fconf.stderr.on('data', (data) => {
			console.log(`stderr: ${data}`);
		});
};

var loadConfigFromDisk = function (dir) {
	if (!dir) {
		dir = appConfig.configStateDir;
	}

	// files are sorted by modification time in order to determine in which mode is the wifi interface.
	// this is not very reliable hack, some underlying structure of config files should store this information.
	var stateFiles = fs.readdirSync(dir).map(function (fileName) {
		return {
			name: fileName,
			time: fs.statSync(dir + '/' + fileName).mtime.getTime()
		};
	}).sort(function (a, b) {
		return a.time - b.time;
	}).map(function (v) {
		return v.name;
	});

	for (var i in stateFiles) {
		var filePath = stateFiles[i];
		if (filePath.substr(-5) === '.json') {
			var fileName = filePath.slice(0, -5);
			var fileData = fs.readFileSync(dir + '/' + filePath, {encoding: 'utf-8'});
			//s.configFiles[fileName] = fileData;
			var state = JSON.parse(fileData);
			// this assumes interface property will always be set in the state file.
			var iface = state.config.interface;
			var mode = null;
			switch (fileName) {
				case "access_point": // todo: wi-fi_ap
					state.type = "wifi";
					mode = "ap";
					break;
				case "wireless": // todo: wi-fi_client
					state.type = "wifi";
					mode = "client";
					break;
				case "wired": // todo: ethernet
					state.type = "ethernet";
					break;
				case "4g":
				case "3g":
					state.type = fileName;
			}
			if (mode) {
				var modeConfig = {
					config: state.config,
					defaults: {}
				};
				if (!s.fconf[iface]) {
					delete state.config;
					s.fconf[iface] = state;
				} else if (!s.fconf[iface].enabled) {
					s.fconf[iface].enabled = state.enabled;
				}
				s.fconf[iface].mode = mode;
				s.fconf[iface][mode] = modeConfig;
			} else {
				state.defaults = {};
				state.status = {}; // temp
				s.fconf[iface] = state;
			}
		}
	}
	//debug
	console.log(JSON.stringify(s.fconf, null, 4));
};

// startup init
s.fconf = {};
loadConfigFromDisk();

