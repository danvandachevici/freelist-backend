var uuidLib 	= require ('node-uuid');

var log 		= require ('./log');
var tokens 		= {};

tokens.generate = function (env, type, user_id, expires, cb) {
	var token = uuidLib.v4().toLowerCase();
	var toinsert = {
		_id: token,
		expires: expires,
		created: new Date().getTime,
		user_id: user_id,
		type: type
	};
	env.mongo_freelist.tokens.insertOne(toinsert, function (err, inserted) {
		if (err) {
			log.error("Error inserting token:", err);
			return cb(err);
		}
		cb(null, token);
	});
};
tokens.check = function (env, type, token, cb) {
	token = token.toLowerCase();
	env.mongo_freelist.tokens.findOne({_id: token}, function (err, doc) {
		if (err) {
			log.error("Error inserting token:", err);
			return cb(err);	
		}
		if ( !doc || (doc.hasOwnProperty('valid') && doc.valid === false) ) {
			log.debug("No such token found", token);
			return cb("TokenExpired");
		}
		var now = new Date().getTime();
		if (doc.type !== type || now > doc.expires) {
			log.debug("Token expired, or wrong type");
			return cb("TokenExpired");
		}
		cb(null, doc);
	});
};
tokens.invalidate = function (env, token, cb) {
	token = token.toLowerCase();
	env.mongo_freelist.tokens.updateOne({_id: token}, {$set: {valid: false}}, function (err, upd) {
		if (err) {
			return cb(true);
		}
		cb(null);
	});
}
tokens.authenticateMiddleware = function (env, optionalType){
	var type = optionalType || 'login';

	return function (req, resp, next) {
		if (!req || !req.body || !req.body.auth || !req.body.auth.token) {
			log.error("No token");
			resp.status(401).send("Unauthorized");
			return;
		}
		var token = req.body.auth.token;
		if ( ! token ) {
			log.error("No token");
			resp.status(401).send("Unauthorized");
			return;
		}
		if (typeof token !== "string") {
			log.error("Token is not string");
			resp.status(401).send("Unauthorized");
			return;
		}
		token = token.toLowerCase();
		if ( ! token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)){
			log.error("Token does not match token regex");
			resp.status(401).send("Unauthorized");
			return;
		}
		env.mongo_freelist.tokens.findOne({_id: token}, function (err, doc) {
			if (err) {
				log.error("Error finding token:", err);
				resp.status(500).send("Internal server error");
				return;
			}
			if (!doc) {
				log.error("Token does not exist");
				resp.status(401).send("Unauthorized");
				return;
			}
			var now = new Date().getTime();
			if (doc.type !== type || doc.expires < now) {
				log.debug("Wrong type of token, or token expired", doc);
				resp.status(200).send("Wrong login");
			}
			req.auth = {
				user_id: doc.user_id
			}
			next();
		});
	};
};

module.exports = tokens;