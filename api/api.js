var express 		= require('express');
var api 			= express.Router();
var log 			= require('../lib/log');

var enabledModules 	= ['auth', 'lists'];

module.exports = function (env) {
	for (var i = 0; i < enabledModules.length; i++){
		var moduleName = enabledModules[i];
		log.info ("Enabling module", moduleName);
		api.use("/" + moduleName, require ('./' + moduleName)(env));
	}
	return api;
};