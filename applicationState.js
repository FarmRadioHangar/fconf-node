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
		let fileName = defaultsFiles[i];
		if (fileName.substr(-5) === '.json') {
			let interfaceType = fileName.slice(0, -5); //filename is the corresponding fconf command
			fconf_defaults.set(interfaceType, JSON.parse(fs.readFileSync(dir + '/' + fileName, {encoding: 'utf-8'})));
		}
	}
};
loadConfigDefaultsFromDisk();

var deviceProto = {
	'wifi': JSON.stringify({
		ap: {
			config: false,
			defaults: fconf_defaults.get("access-point"),
			command: "access-point"
		},
		client: {
			config: false,
			defaults: fconf_defaults.get("wifi-client"),
			command: "wifi-client"
		},
	}),
	'3g': JSON.stringify({
		voice: {
			config: false,
			defaults: fconf_defaults.get("voice-channel"),
			command: "voice-channel"
		},
		ras: {
			config: false,
			defaults: fconf_defaults.get("3g-ras"),
			command: "3g-ras"
		},
	}),
	'4g': JSON.stringify({
		ndis: {
			config: false,
			defaults: fconf_defaults.get("4g-ndis"),
			command: "4g-ndis"
		},
	}),

	get(key) {
		let proto = deviceProto[key] ? JSON.parse(deviceProto[key]) : {
			config: false,
			defaults: fconf_defaults.get(key),
			command: key,
		};
		return Object.assign(proto, { enabled: false });
	},
};

var getSystemInterfaces = function () {
	let result = child_process.spawnSync(appConfig.fconfPath, ['list-interface']);
	let system = new Map();
	// todo: handle case if path not exists
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

	// files are sorted by modification time in order to determine in which mode is the interface when disabled.
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
		let fileName = stateFiles[i];
		// fileName is in the form of "command-name@interface.json" (e.g. access-point@wlan0.json)
		if (fileName.substr(-5) === '.json') {
			let fileNameParts = fileName.slice(0, -5).split('@');
			let iface = fileNameParts[1];
			if (!iface) {
				console.error(`invalid filename "${fileName}" in fconf configuration folder`);
				continue;
			}
			let fileData = fs.readFileSync(dir + '/' + fileName, {encoding: 'utf-8'});
			let ifaceSettings = JSON.parse(fileData);
			let mode = null;
			let command = fileNameParts[0];
			switch (command) {
				case "access-point":
					ifaceSettings.type = "wifi";
					mode = "ap";
					break;
				case "wifi-client":
					ifaceSettings.type = "wifi";
					mode = "client";
					break;
				case "4g-ndis":
					ifaceSettings.type = "4g";
					mode = "ndis";
					break;
				case "3g-ras":
					ifaceSettings.type = "3g";
					mode = "ras";
					break;
				case "voice-channel":
					ifaceSettings.type = "3g";
					mode = "voice";
					if (ifaceSettings.enabled) {
						if (ifaceSettings.config && ifaceSettings.config.number) { // these must exist
							ifaceSettings.uiLabel = ifaceSettings.config.number;
						}
					}
					break;
				case "ethernet":
					ifaceSettings.type = command;
			}

			if (mode) {
				// todo: fix this mess
				fconf.set(iface, Object.assign(deviceProto.get(ifaceSettings.type), fconf.get(iface)));
				fconf.set(iface, Object.assign(fconf.get(iface) ? fconf.get(iface) : {}, {
					type: ifaceSettings.type,
					mode: mode,
					[mode]: {
						config: ifaceSettings.config,
						command: command,
						defaults: fconf_defaults.get(command),
					},
				}));

				if (!fconf.get(iface).enabled) {
					fconf.get(iface).enabled = ifaceSettings.enabled;
				}

			} else {
				ifaceSettings.defaults = fconf_defaults.get(command);
				ifaceSettings.command = command;
				fconf.set(iface, Object.assign(fconf.get(iface) ? fconf.get(iface) : {}, ifaceSettings));
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
			//console.log('fconf', key, JSON.stringify(value, null, 4));
			if (system.has(key)) {
				this.interfaces.set(key, Object.assign({ system: system.get(key) }, value));
				system.delete(key);
				fconf.delete(key);
			}
		});

		this.fdevices.forEach((value, key) => {
			//console.log('fdevices', key, value);
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
			//console.log('system', key, value);
			if (key !== 'lo') {
				this.interfaces.set(key, {
					type: '',
					system: value,
				});
			}
		});

		//debug
		//console.log('======================================');
		//console.log('interfaces', JSON.stringify(this.interfaces, null, 4));
	},
};

