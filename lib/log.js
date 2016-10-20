var colors = require('colors');
var log = {};

var methods = {
	none: 0,
	error: 'red',
	info: 'cyan',
	debug: 'yellow'
};
var options = {
	minimumLoggableLevel: 1
};

log.setLogLevel = function (loglevelName) {
	if (methods[loglevelName]) {
		options.minimumLoggableLevel = methods[loglevelName];
	} else {
		options.minimumLoggableLevel = 1;
	}
}

var ret = {};
log.set

for (var method in methods) {
	ret[method] = (function(method) {
		return function () {
			var d = new Date();
			if (options.minimumLoggableLevel > methods[method]){
				return null;
			}
			var datestring = d.getFullYear() + "/" + 
							("0" + (d.getMonth() + 1)).slice(-2) + "/" +
							("0" + d.getDate()).slice(-2) + " " +
							("0" + d.getHours()).slice(-2) + ":" + 
							("0" + d.getMinutes()).slice(-2) + ":" + 
							("0" + d.getSeconds()).slice(-2) + "." + 
							("00" + d.getMilliseconds()).slice(-3);
			var msg = datestring + "\t" + (" " + method).slice(-5).toUpperCase().underline;
			msg = msg[methods[method]];
			for (var i = 0; i < arguments.length; i++) {
				if (typeof (arguments[i]) === "object") {
					msg += "\t" + JSON.stringify(arguments[i]);
				} else {
					msg += "\t" + arguments[i];
				}
			}
			console.log (msg);
		}
	})(method)
}
module.exports = ret;