var os = require("os");
var fs = require("fs");
var child_process = require('child_process');

var appConfig = require("./config.json");
var fconf_defaults = new Map();

var loadConfigDefaultsFromDisk = function (dir) {
	if (!dir) {
		dir = appConfig.configStateDir + '/defaults';
	}

	let defaultsFiles = fs.readdirSync(dir);
	fconf_defaults.clear();

	for (let i in defaultsFiles) {
		let filePath = defaultsFiles[i];
		if (filePath.substr(-5) === '.json') {
			let fileName = filePath.slice(0, -5); //fileName is interface type (command)
			fconf_defaults.set(fileName, JSON.parse(fs.readFileSync(dir + '/' + filePath, {encoding: 'utf-8'})));
		}
	}
};
loadConfigDefaultsFromDisk();

var deviceProto = {
	'wifi': JSON.stringify({
		ap: {
			defaults: fconf_defaults.get("access-point"),
			command: "access-point"
		},
		client: {
			defaults: fconf_defaults.get("wifi-client"),
			command: "wifi-client"
		},
	}),
	'3g': JSON.stringify({
		voice: {
			defaults: fconf_defaults.get("voice-channel"),
			command: "voice-channel"
		},
		ras: {
			defaults: fconf_defaults.get("3g-ras"),
			command: "3g-ras"
		},
	}),
	'4g': JSON.stringify({
		ndis: {
			defaults: fconf_defaults.get("4g-ndis"),
			command: "4g-ndis"
		},
	}),

	get(key) {
		return deviceProto[key] ? JSON.parse(deviceProto[key]) : {
			defaults: fconf_defaults.get(key),
			command: key,
		};
	},
};

var getSystemInterfaces = function () {
	let result = child_process.spawnSync(appConfig.fconfPath, ['list-interface']);
	let system = new Map();
	if (result.status) {
		console.error('Error getting interfaces from system', result.stderr.toString());
	} else {
		let activeInterfaces = os.networkInterfaces();
		JSON.parse(result.stdout.toString()).forEach((iface) => {
			system.set(iface.Name, {
				properties: iface.Flags,
				mtu: iface.MTU,
				addresses: activeInterfaces[iface.Name],
			});
		});
	}
	return system;
};

var loadConfigFromDisk = function (dir) {
	if (!dir) {
		dir = appConfig.configStateDir;
	}

	// files are sorted by modification time in order to determine in which mode is the interface.
	// this is not a very reliable hack, some underlying structure of config files should store this information.
	let stateFiles = fs.readdirSync(dir).map((fileName) => {
		return {
			name: fileName,
			time: fs.statSync(dir + '/' + fileName).mtime.getTime()
		};
	}).sort((a, b) => {
		return a.time - b.time;
	}).map((v) => {
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
				console.error(`invalid filename "${filePath}" in fconf configuration folder`);
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
				// todo: fix this mess
				fconf.set(iface, Object.assign(deviceProto.get(state.type), fconf.get(iface)));
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


module.exports = {
	fdevices: new Map(),
	interfaces: {}, //this is object instead of Map because we want to export it as JSON
	getDeviceProto: deviceProto.get,

	updateInterfaces() {
		this.interfaces = {
			set(key, value) {
				this[key] = value;
			}
		};

		let system = getSystemInterfaces();
		let fconf = loadConfigFromDisk();

		fconf.forEach((value, key) => {
			console.log('fconf', key, JSON.stringify(value, null, 4));
			if (system.has(key)) {
				this.interfaces.set(key, Object.assign({ system: system.get(key) }, value));
				system.delete(key);
				fconf.delete(key);
			}
		});

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
						iface.system = Object.assign(system.get('ppp0'), iface.system);
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
					iface = Object.assign(this.getDeviceProto('3g'), iface);
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

		//debug
		console.log('======================================');
		console.log('interfaces', JSON.stringify(this.interfaces, null, 4));
	},
};

