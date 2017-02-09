var os = require("os");
var fs = require("fs");
var child_process = require('child_process');

var appConfig = require("./config.json");
var fconf_defaults = new Map();

var getSystemInterfaces = function () {
	let result = child_process.spawnSync(appConfig.fconfPath, ['list-interface']);
	if (result.status) {
		handleFailure(response, result.stderr.toString());
		return false;
	} else {
		let system = new Map();
		var activeInterfaces = os.networkInterfaces();
		JSON.parse(result.stdout.toString()).forEach(function(iface) {
			system.set(iface.Name, {
				properties: iface.Flags,
				mtu: iface.MTU,
				addresses: activeInterfaces[iface.Name],
			});
		});
		return system;
	}
};

var loadConfigFromDisk = function (dir) {
	if (!dir) {
		dir = appConfig.configStateDir;
	}

	// files are sorted by modification time in order to determine in which mode is the interface.
	// this is not a very reliable hack, some underlying structure of config files should store this information.
	let stateFiles = fs.readdirSync(dir).map(function (fileName) {
		return {
			name: fileName,
			time: fs.statSync(dir + '/' + fileName).mtime.getTime()
		};
	}).sort(function (a, b) {
		return a.time - b.time;
	}).map(function (v) {
		return v.name;
	});

	let fconf = new Map();
	for (let i in stateFiles) {
		let filePath = stateFiles[i];
		// fileName is in the form of "command-name@interface.json" (e.g. access-point@wlan0.json)
		if (filePath.substr(-5) === '.json') {
			let fileName = filePath.slice(0, -5).split('@');
			let iface = fileName[1];
			if (!iface) {
				console.log('invalid filename', filePath);
				continue;
			}
			let fileData = fs.readFileSync(dir + '/' + filePath, {encoding: 'utf-8'});
			let state = JSON.parse(fileData);
			let mode = null;
			let command = fileName[0];
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
						fconf.set(iface, Object.assign({
							ap: {
								defaults: fconf_defaults.get("access-point"),
								command: "access-point"
							},
							client: {
								defaults: fconf_defaults.get("wifi-client"),
								command: "wifi-client"
							}
						}, fconf.get(iface)));
						break;
					case "3g":
						fconf.set(iface, Object.assign({
							voice: {
								//defaults: fconf_defaults.get("voice-channel"),
								command: "voice-channel"
							},
							ras: {
								defaults: fconf_defaults.get("3g-ras"),
								command: "3g-ras"
							}
						}, fconf.get(iface)));
				}
				fconf.set(iface, Object.assign(fconf.get(iface) ? fconf.get(iface) : {}, {
					type: state.type,
					mode: mode,
					[mode]: {
						config: state.config,
						command: command,
						defaults: fconf_defaults.get(command),
					},
				}));

				if (!fconf.get(iface).enabled) {
					fconf.get(iface).enabled = state.enabled;
				}

			} else {
				state.defaults = fconf_defaults.get(command);
				state.command = command;
				fconf.set(iface, Object.assign(fconf.get(iface) ? fconf.get(iface) : {}, state));
			}
		}
	}
	return fconf;
	//debug
	//console.log(JSON.stringify(fconf, null, 4));
};

var loadConfigDefaultsFromDisk = function (dir) {
	if (!dir) {
		dir = appConfig.configStateDir + '/defaults';
	}

	var defaultsFiles = fs.readdirSync(dir);

	for (var i in defaultsFiles) {
		var filePath = defaultsFiles[i];
		if (filePath.substr(-5) === '.json') {
			var fileName = filePath.slice(0, -5); //fileName is interface type (command)
			fconf_defaults.set(fileName, JSON.parse(fs.readFileSync(dir + '/' + filePath, {encoding: 'utf-8'})));
		}
	}
};
loadConfigDefaultsFromDisk();

module.exports = {
	fdevices: new Map(),
	interfaces: {}, //this is object instead of Map because we want to export it as JSON

	updateInterfaces() {
		this.interfaces = {
			set(key, value) {
				this[key] = value;
			}
		};

		let system = getSystemInterfaces();
		let fconf = loadConfigFromDisk();

		fconf.forEach(function(value, key) {
			console.log('fconf', key, JSON.stringify(value, null, 4));
			if (system.has(key)) {
				this.interfaces.set(key, Object.assign({ system: system.get(key) }, value));
				system.delete(key);
				fconf.delete(key);
			}
		}.bind(this));

		this.fdevices.forEach((value, key) => {
			console.log('fdevices', key, value);
			let iface;
			if (fconf.has(key)) {
				iface = Object.assign({ system: value }, fconf.get(key));
				//if dongle is configured for data and enabled, there should be ppp network interface for it
				if (iface.mode === 'ras' && iface.enabled) {
					// default ppp interface is ppp0, so we're using it
					// we could be more clever and check for 'pointtopoint' flag in the NI properties
					iface.uiLabel = 'ppp0';
					if (system.get('ppp0')) {
						Object.assign(iface.system, system.get('ppp0'));
						system.delete('ppp0');
						iface.system.online = true;
					} else {
						iface.system.online = false;
					}
				}
				fconf.delete(key);
			} else {
				iface = {
					type: '3g',
					system: value,
				};
				if (value.imsi) {
					let simPrototype = {
						voice: {
							//defaults: this..fconf_defaults.get("voice-channel"),
							command: "voice-channel"
						},
						ras: {
							defaults: fconf_defaults.get("3g-ras"),
							command: "3g-ras"
						}
					};
					iface = Object.assign(simPrototype, iface);
				} else {
					iface.uiLabel = 'No SIM';
				}
			}
			this.interfaces.set(key, iface);
		});

		//configured but not existing
		fconf.forEach((value, key) => {
			this.interfaces.set(key, Object.assign({ system: false }, value));
		});

		//existing but unconfigured
		system.forEach((value, key) => {
			console.log('system', key, value);
			if (key !== 'lo') {
				this.interfaces.set(key, {
					type: '',
					config: false,
					system: value,
				});
			}
		});

		//this.interfaces.forEach(function(value, key) {
			console.log('======================================');
			console.log('interfaces', JSON.stringify(this.interfaces, null, 4));
		//});
	},
};

