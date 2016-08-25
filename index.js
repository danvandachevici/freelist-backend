var express 		= require('express');
var app 			= express();
var bodyParser      = require('body-parser');
var morgan          = require ('morgan');
var mongoLib        = require ('mongodb').MongoClient;
var async           = require ('async');

var log 			= require ('./lib/log');

var config          = require ('./config');
var api 			= require('./api/api');
var env 			= {};

app.use(morgan('dev'));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());                             // for parsing application/json
app.use('/api', api(env));



// app.get("*", function (req, resp) {
//     // angular app -> route everything through index.
//     resp.sendFile(config.documentRoot + "/index.html");
// });
// // catch all
// app.all("*", function (req, resp) {
//     resp.status(404).send("Not found");
// });


async.auto({
	mongos: function (cb_auto) {
		var it = function (mongoConfigObj, cb_map) {
			var url = 'mongodb://' +
						mongoConfigObj.username + ":" + 
						mongoConfigObj.password + "@" + 
						mongoConfigObj.path + "?authMechanism=DEFAULT&authSource=admin";
			mongoLib.connect(url, function(err, db) {
				if (err) {
					log.error("Error connecting to mongo: ", err);
					return cb_map(err);
				}
				log.info("Connection to mongo " + mongoConfigObj.name + " succeeded !");
				var ret = {
					name: mongoConfigObj.name,
					mongo: {}
				};
				for (var col in mongoConfigObj.collections) {
					ret.mongo[col] = db.collection(mongoConfigObj.collections[col]);
				}
				cb_map(null, ret);
			});
		};
		async.map(config.mongo, it, function (err, results) {
			if (err) {
				return cb_auto(err);
			}
			for (var i = 0; i < results.length; i++) {
				env["mongo_" + results[i].name] = results[i].mongo;
			}
			cb_auto(null);
		});
	}
}, function (err, results) {
	app.listen(config.serverPort, function () {
		log.info('server is listening on port ' + config.serverPort);
	});
});