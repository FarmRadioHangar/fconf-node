var os = require("os");
var fs = require("fs");
var child_process = require('child_process');
var appConfig = require("./config.json");
var s = require("./applicationState");
var myLib = require("./myLib");

// the response parameter of the exported functions can be httpResponse object or callback function

var updateWiFi = function (params, response) {
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
	args.push(params.name);

	if (params.enabled) {
		if (s.fconf[params.name] && s.fconf[params.name].enabled) {
			// if changing mode, first disable existing interface
			if (s.fconf[params.name].mode !== params.mode) {
				args.push('--enable');
				var args_d = [params.mode === 'ap' ? 'wifi-client' : 'access-point', params.name, '--disable'];
				var result = child_process.spawnSync(appConfig.fconfPath, args_d);
				if (result.status) {
					handleFailure(response, result.stderr.toString());
					return;
				}
				s.fconf[params.name].enabled = false;
			}
		} else {
			args.push('--enable');
		}
	} else if (params.enabled === false && s.fconf[params.name] && s.fconf[params.name].enabled) {
		args.push('--disable');
		// todo: handle special case when both config and disable should be applied, passing both to the binary will fail
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

exports.updateWiFi = updateWiFi;

var updateEthernet = function (params, response) {
	console.error('params:', params);
	if (!myLib.checkObjectProperties(params, ['name'])) {
		handleFailure(response, "invalid input");
		return;
	}
	var args = ['ethernet', params.name];

	if (params.enabled === false) {
		if (s.fconf[params.name] && s.fconf[params.name].enabled) {
			args.push('--disable');
		}
		// todo: handle special case when both config and disable should be applied, passing both to the binary will fail
	} else if (params.enabled === true) {
		args.push('--enable');
		/*
		if (s.fconf[params.name] && s.fconf[params.name].enabled) {
			args.push('--reload');
		} else {
			args.push('--enable');
		}
		*/
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

exports.updateEthernet = updateEthernet;

var update3g = function (params, response) {
	if (!myLib.checkObjectProperties(params, ['name', 'mode'])) {
		handleFailure(response, "invalid input");
		return;
	}
	var args = [];
	if (params.mode === 'voice') {
		args.unshift('voice-channel');
	} else if (params.mode === 'ras') {
		args.unshift('3g-ras');
	} else {
		handleFailure(response, "invalid input");
		return;
	}
	args.push(params.name);

	if (params.enabled) {
		if (s.fconf[params.name] && s.fconf[params.name].enabled) {
			// if changing mode, first disable existing interface
			if (s.fconf[params.name].mode !== params.mode) {
				args.push('--enable');
				var args_d = [params.mode === 'ras' ? 'voice-channel' : '3g-ras', params.name, '--disable'];
				var result = child_process.spawnSync(appConfig.fconfPath, args_d);
				if (result.status) {
					handleFailure(response, result.stderr.toString());
					return;
				}
			}
		} else {
			args.push('--enable');
		}
	} else if (s.fconf[params.name] && s.fconf[params.name].enabled) {
		args.push('--disable');
		// todo: handle special case when both config and disable should be applied, passing both to the binary will fail
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

exports.update3g = update3g;

var update4g = function (params, response) {
	console.error('update4g', 'params:', params);
	params.mode = 'ndis'; //temp
	if (!myLib.checkObjectProperties(params, ['name', 'mode'])) {
		handleFailure(response, "invalid input");
		return;
	}
	var args = [];
	if (params.mode === 'ndis') {
		args.unshift('4g-ndis');
	} else {
		handleFailure(response, "invalid input, unknown mode");
		return;
	}
	args.push(params.name);

	if (params.enabled === false) {
		if (s.fconf[params.name] && s.fconf[params.name].enabled) {
			args.push('--disable');
		}
		// todo: handle special case when both config and disable should be applied, passing both to the binary will fail
	} else if (params.enabled === true) {
		args.push('--enable');
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

exports.update4g = update4g;

exports.configRemove = function (params, response) {
	console.error('params:', params);
	if (!params.name || !s.fconf[params.name]) {
		handleFailure(response, "invalid interface name");
		return;
	}
	var mode = params.mode ? params.mode : s.fconf[params.name].mode;
	var command = mode ? s.fconf[params.name][mode].command : s.fconf[params.name].command;
	fconfExec([command, params.name, '--remove'], null, (error, output) => {
		if (error) {
			handleFailure(response, error);
		} else {
			if (mode) {
				delete s.fconf[params.name][mode].config;
			} else {
				delete s.fconf[params.name].config;
			}
			var responseData = { interfaceUpdate: {
				[params.name]: s.fconf[params.name],
			}};
			if (typeof response === 'function') {
				response(null, responseData);
			} else {
				myLib.httpGeneric(200, responseData, response);
			}
		}
	});
};

exports.interfaceUpdate = function (params, response) {
	console.error('params:', params);
	if (!params.name || !s.fconf[params.name]) {
		handleFailure(response, "invalid interface name");
		return;
	}
	switch (s.fconf[params.name].type) {
		case "ethernet":
			updateEthernet(params, response);
			break;
		case "wifi":
			updateWiFi(params, response);
			break;
		case "3g":
			update3g(params, response);
			break;
		case "4g":
			update4g(params, response);
			break;
	}
};

exports.interfaceType = function (params, response) {
	console.error('params:', params);
	if (!myLib.checkObjectProperties(params, ['name', 'type'])) {
		handleFailure(response, "invalid input");
	} else {
		if (s.fconf[params.name]) {
			s.fconf[params.name].type = params.type;
		} else {
			s.fconf[params.name] = {
				name: params.name,
				type: params.type,
			};
		}
		switch (params.type) {
			case "ethernet":
				s.fconf[params.name].command = params.type;
				s.fconf[params.name].defaults = s.fconf_defaults[params.type];
				break;
			case "4g":
				s.fconf[params.name].ndis = {
					defaults: s.fconf_defaults["4g-ndis"],
					command: "4g-ndis"
				};
				break;
			case "wifi":
				Object.assign(s.fconf[params.name], {
					ap: {
						defaults: s.fconf_defaults["access-point"],
						command: "access-point"
					},
					client: {
						defaults: s.fconf_defaults["wifi-client"],
						command: "wifi-client"
					}
				});
				break;
		}
		var responseData = { interfaceUpdate: {
			[params.name]: s.fconf[params.name],
		}};
		if (typeof response === 'function') {
			response(null, responseData);
		} else {
			myLib.httpGeneric(200, responseData, response);
		}
	}
};

exports.interfaceEnable = function (params, response) {
	console.error('params:', params);
	if (!myLib.checkObjectProperties(params, ['name', 'enabled'])) {
		handleFailure(response, "invalid input");
	} else if (!s.fconf[params.name]) {
		handleFailure(response, "interface not found");
	} else {
		if (s.fconf[params.name].enabled === params.enabled) {
			myLib.consoleLog('warning', 'fconf.interfaceEnable', 'Value already set', params);
		}
		var command = s.fconf[params.name].mode ? s.fconf[params.name][s.fconf[params.name].mode].command : s.fconf[params.name].command;
		var args = [command, params.name, params.enabled ? '--enable' : '--disable'];
		fconfExec(args, null, (error) => {
			if (error) {
				handleFailure(response, error);
			} else {
				var responseData = { interfaceEnable: {
					[params.name]: params.enabled
				}};
				if (typeof response === 'function') {
					response(null, responseData);
				} else {
					myLib.httpGeneric(200, responseData, response);
				}
			}
		});
	}
};

exports.getCurrentState = function (params, response) {
	loadConfigFromDisk();
	if (typeof response === 'function') {
		response(null, { interfaceInit: s.fconf });
	} else {
		myLib.httpGeneric(200, JSON.stringify(s.fconf), response, "DEBUG::getCurrentState");
	}
};

var handleFailure = function (response, error) {
	console.log('handleFailure', error);
	if (typeof response === 'function') {
		response(error);
	} else {
		myLib.httpGeneric(512, error, response);
	}
};

var fconfExec = function(args, config, cb) {
		console.log('fconfExec', args);
		var fconf = child_process.spawn(appConfig.fconfPath, args);
		var output = '';
		if (config) {
			fconf.stdin.write(JSON.stringify(config) + "\n");
		}
		fconf.on('close', (code) => {
			if (code !== 0) {
				console.log(`fconf process exited with code ${code}`);
				cb(code, output);
			} else {
				loadConfigFromDisk();
				cb(null, output);
			}
		});
		fconf.on('error', (err) => {
			console.log(`Failed to start child process. ${err}`);
		});
		fconf.stdout.on('data', (data) => {
			output += data;
			console.log(`stdout: ${data}`);
		});

		fconf.stderr.on('data', (data) => {
			output += data;
			console.log(`stderr: ${data}`);
		});
};

var getSystemInterfaces = function () {
	var result = child_process.spawnSync(appConfig.fconfPath, ['list-interface']);
	if (result.status) {
		handleFailure(response, result.stderr.toString());
		return;
	} else {
		JSON.parse(result.stdout.toString()).forEach(function(interface) {
			if (interface.Name !== 'lo') {
				s.fconf[interface.Name] = Object.assign({
					type: '',
					system: {
						properties: interface.Flags,
						mtu: interface.MTU,
					}
				}, s.fconf[interface.Name]);
			}
		});
		var activeInterfaces = os.networkInterfaces();
		for (var interfaceName in activeInterfaces) {
			if (interfaceName !== 'lo') {
				s.fconf[interfaceName].system.addresses = activeInterfaces[interfaceName];
			}
		}

		console.log('existingInterfaces', s.fconf);
	}
};

var loadConfigDefaultsFromDisk = function (dir) {
	if (!dir) {
		dir = appConfig.configStateDir + '/defaults';
	}
	s.fconf_defaults = {};

	var defaultsFiles = fs.readdirSync(dir);
	for (var i in defaultsFiles) {
		var filePath = defaultsFiles[i];
		if (filePath.substr(-5) === '.json') {
			var fileName = filePath.slice(0, -5); //fileName is interface type (command)
			s.fconf_defaults[fileName] = JSON.parse(fs.readFileSync(dir + '/' + filePath, {encoding: 'utf-8'}));
		}
	}
};

var loadConfigFromDisk = function (dir) {
	getSystemInterfaces();
	if (!dir) {
		dir = appConfig.configStateDir;
	}

	loadConfigDefaultsFromDisk();
	// files are sorted by modification time in order to determine in which mode is the wifi interface.
	// this is not a very reliable hack, some underlying structure of config files should store this information.
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
		// fileName is in the form of "command-name@interface.json" (e.g. access-point@wlan0.json)
		if (filePath.substr(-5) === '.json') {
			var fileName = filePath.slice(0, -5).split('@');
			var fileData = fs.readFileSync(dir + '/' + filePath, {encoding: 'utf-8'});
			var state = JSON.parse(fileData);
			var iface = fileName[1];
			var mode = null;
			var command = fileName[0];
			var uiLabel;
			switch (fileName[0]) {
				case "access-point":
					state.type = "wifi";
					mode = "ap";
					break;
				case "wifi-client":
					state.type = "wifi";
					mode = "client";
					break;
				case "4g-ndis":
					state.type = "4g";
					mode = "ndis";
					break;
				case "3g-ras":
					state.type = "3g";
					mode = "ras";
					if (state.enabled) {
						uiLabel = 'ppp0';
					}
					break;
				case "voice-channel":
					state.type = "3g";
					mode = "voice";
					break;
				case "ethernet":
					state.type = fileName[0];
			}
			if (mode) {
				switch (state.type) {
					case "wifi":
						s.fconf[iface] = Object.assign({
							ap: {
								defaults: s.fconf_defaults["access-point"],
								command: "access-point"
							},
							client: {
								defaults: s.fconf_defaults["wifi-client"],
								command: "wifi-client"
							}
						}, s.fconf[iface]);
						break;
					case "3g":
						s.fconf[iface] = Object.assign({
							voice: {
								//defaults: s.fconf_defaults["voice-channel"],
								command: "voice-channel"
							},
							ras: {
								defaults: s.fconf_defaults["3g-ras"],
								command: "3g-ras"
							}
						}, s.fconf[iface]);
				}
				s.fconf[iface] = Object.assign(s.fconf[iface] ? s.fconf[iface] : {}, {
					type: state.type,
					mode: mode,
					[mode]: {
						config: state.config,
						command: command,
						defaults: s.fconf_defaults[command],
					},
				});
				if (!s.fconf[iface].enabled) {
					s.fconf[iface].enabled = state.enabled;
				}
			} else {
				state.defaults = s.fconf_defaults[command];
				state.command = command;
				s.fconf[iface] = Object.assign(s.fconf[iface] ? s.fconf[iface] : {}, state);
			}
		}
	}
	//debug
	//console.log(JSON.stringify(s.fconf, null, 4));
};

