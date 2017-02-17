var child_process = require('child_process');
var appConfig = require("./config.json");
var s = require("./applicationState");
var myLib = require("./myLib");

// the response parameter of the exported functions can be httpResponse object or callback function

var updateWiFi = function (params, response) {
	if (!myLib.checkObjectProperties(params, ['name', 'mode'])) {
		handleFailure(response, "invalid input");
		return;
	}
	let args = [];
	if (params.mode === 'client') {
		args.unshift('wifi-client');
	} else if (params.mode === 'ap') {
		args.unshift('access-point');
	} else {
		handleFailure(response, "invalid input");
		return;
	}
	args.push(params.name);

	let iface = s.interfaces[params.name];
	if (params.enabled) {
		// if changing mode, first disable existing interface
		if (iface && iface.enabled && iface.mode !== params.mode) {
			let args_d = [params.mode === 'ap' ? 'wifi-client' : 'access-point', params.name, '--disable'];
			let result = child_process.spawnSync(appConfig.fconfPath, args_d);
			if (result.status) {
				handleFailure(response, result.stderr.toString());
				return;
			}
		}
		args.push('--enable');
	} else if (params.enabled === false && iface && iface.enabled) {
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
			let responseData = { interfaceUpdate: {
				[params.name]: s.interfaces[params.name],
			}};
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
	if (!myLib.checkObjectProperties(params, ['name'])) {
		handleFailure(response, "invalid input");
		return;
	}
	let args = ['ethernet', params.name];

	if (params.enabled === false) {
		if (s.interfaces[params.name] && s.interfaces[params.name].enabled) {
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
			let responseData = { interfaceUpdate: {
				[params.name]: s.interfaces[params.name],
			}};
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
	let args = [];
	if (params.mode === 'voice') {
		args.unshift('voice-channel');
	} else if (params.mode === 'ras') {
		args.unshift('3g-ras');
	} else {
		handleFailure(response, "invalid input");
		return;
	}
	args.push(params.name);

	let iface = s.interfaces[params.name];
	if (params.enabled === true) {
		// if changing mode, first disable existing interface
		if (iface && iface.enabled && iface.mode !== params.mode) {
			let args_d = [params.mode === 'ras' ? 'voice-channel' : '3g-ras', params.name, '--disable'];
			let result = child_process.spawnSync(appConfig.fconfPath, args_d);
			if (result.status) {
				handleFailure(response, result.stderr.toString());
				return;
			}
		}
		args.push('--enable');
	} else if (params.enabled === false && iface && iface.enabled) {
		args.push('--disable');
		// todo: handle special case when both config and disable should be applied, passing both to the binary will fail
	}

	if (params.config) {
		if (!params.config.imsi) {
			params.config.imsi = params.name;
		}
		args.push('--config=stdin');
	}
	fconfExec(args, params.config, (error) => {
		if (error) {
			handleFailure(response, error);
		} else {
			let responseData = { interfaceUpdate: {
				[params.name]: s.interfaces[params.name],
			}};
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
	//params.mode = 'ndis'; //temp
	if (!myLib.checkObjectProperties(params, ['name', 'mode'])) {
		handleFailure(response, "invalid input");
		return;
	}
	let args = [];
	if (params.mode === 'ndis') {
		args.unshift('4g-ndis');
	} else {
		handleFailure(response, "invalid input, unknown mode");
		return;
	}
	args.push(params.name);

	if (params.enabled === false) {
		if (s.interfaces[params.name] && s.interfaces[params.name].enabled) {
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
			let responseData = { interfaceUpdate: {
				[params.name]: s.interfaces[params.name],
			}};
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
	if (!params.name || !s.interfaces[params.name]) {
		handleFailure(response, "invalid interface name");
		return;
	}
	let mode = params.mode ? params.mode : s.interfaces[params.name].mode;
	let command = mode ? s.interfaces[params.name][mode].command : s.interfaces[params.name].command;
	fconfExec([command, params.name, '--remove'], null, (error, output) => {
		if (error) {
			handleFailure(response, error);
		} else {
			let responseData = { interfaceUpdate: {
				[params.name]: s.interfaces[params.name],
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
	if (!params.name || !s.interfaces[params.name]) {
		handleFailure(response, "invalid interface name");
		return;
	}
	switch (s.interfaces[params.name].type) {
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
		default:
			handleFailure(response, "invalid interface type");
	}
};

exports.interfaceType = function (params, response) {
	console.error('params:', params);
	if (!myLib.checkObjectProperties(params, ['name', 'type'])) {
		handleFailure(response, "invalid input");
	} else {
		if (!s.interfaces[params.name]) {
			s.interfaces[params.name] = {
				name: params.name,
			};
		}
		s.interfaces[params.name] = Object.assign(s.getDeviceProto(params.type), s.interfaces[params.name], { type: params.type });

		let responseData = { interfaceUpdate: {
			[params.name]: s.interfaces[params.name],
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
	} else if (!s.interfaces[params.name]) {
		handleFailure(response, "interface not found");
	} else {
		let iface = s.interfaces[params.name];
		if (iface.enabled === params.enabled) {
			myLib.consoleLog('warning', 'fconf.interfaceEnable', 'Value already set', params);
		}
		let command = iface.mode ? iface[iface.mode].command : iface.command;
		let args = [command, params.name, params.enabled ? '--enable' : '--disable'];
		fconfExec(args, null, (error) => {
			if (error) {
				handleFailure(response, error);
			} else {
				let responseData = { interfaceEnable: {
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
	s.updateInterfaces();
	if (typeof response === 'function') {
		response(null, { interfaceInit: s.interfaces });
	} else {
		myLib.httpGeneric(200, JSON.stringify(s.interfaces), response, "DEBUG::getCurrentState");
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
		console.log('fconfExec', args, config);
		let fconf = child_process.spawn(appConfig.fconfPath, args);
		let output = '';
		if (config) {
			fconf.stdin.write(JSON.stringify(config) + "\n");
		}
		fconf.on('close', (code) => {
			if (code !== 0) {
				console.error(`fconf process exited with code ${code}`);
				cb(code, output);
			} else {
				s.updateInterfaces();
				cb(null, output);
			}
		});
		fconf.on('error', (err) => {
			console.error(`Failed to start child process. ${err}`);
		});
		fconf.stdout.on('data', (data) => {
			output += data;
			console.log(`stdout: ${data}`); //debug
		});

		fconf.stderr.on('data', (data) => {
			output += data;
			console.log(`stderr: ${data}`); //debug
		});
};
