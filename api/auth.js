var express 	= require ('express');
var auth 		= express.Router();
var async 		= require ('async');
var uuidLib 	= require ('node-uuid');
var crypto 		= require ('crypto');

var log 		= require ('../lib/log');
var tokens 		= require ('../lib/Tokens');
var errors 		= require ('../lib/Errors');

var private = {};
var local = {};

private.getUser = function (env, email, shouldExist) {
	return function (cb_auto) {
		env.mongo_freelist.users.findOne({email: email}, function (err, doc) {
			if (err){
				log.error("Error finding one user:", err);
				return cb_auto(errors.internalServerError);
			}
			if ( ! doc) {
				return cb_auto(null, null);
			}
			cb_auto(null, doc);
		});
	};
};
private.checkPass = function (pass) {
	return function (results, cb_auto) {
		var user = results.getUser;
		if (!user) {
			log.error("Unknown username")
			return cb_auto(errors.wrongLogin);
		}
		var salt = new Buffer(user.salt, 'base64');
		var hash = crypto.createHmac("sha256", salt).update(pass).digest('hex');
		if (hash !== user.pass) {
			return cb_auto(errors.wrongLogin);
		}
		cb_auto(null);
	};
};
private.loginToken = function (env, save) {
	return function (results, cb_auto) {
		var user = results.getUser || results.createUser;
		if (!user) {
			log.error("Unknown username")
			return cb_auto({code: 200, error: "Wrong login"});
		}
		var day = 86400000;
		var minute = 60000;
		var expires;
		if (save) {
			expires = new Date().getTime() + 30*day;
		} else {
			expires = new Date().getTime() + 1*day;
		}
		tokens.generate(env, 'login', user._id, expires, function (err, token){
			if (err) {
				return cb_auto(errors.internalServerError);
			}
			cb_auto(null, token);
		});
	};
};
private.verifyEmailToken = function (env) {
	return function (results, cb_auto) {
		var day = 86400000;
		var user = results.getUser || results.createUser;
		var expires = new Date().getTime() + 7*day;
		
		tokens.generate(env, 'verify', user._id, expires, function (err, token){
			if (err) {
				return cb_auto(errors.internalServerError);
			}
			cb_auto(null, token);
		});
	};
};
private.createUser = function (env, email, pass) {
	return function (results, cb_auto) {
		var user = results.getUser;
		if (user && user.email === email) {
			return cb_auto(errors.userExists);
		}
		var user_id = uuidLib.v4().toLowerCase();
		var salt = crypto.randomBytes(256);
		var hashPass = crypto.createHmac("sha256", salt).update(pass).digest('hex');
		var toInsert = {
			email: email,
			pass: hashPass,
			salt: salt.toString('base64'),
			created: new Date().getTime(),
			_id: user_id
		};
		env.mongo_freelist.users.insertOne(toInsert, function (err, inserted) {
			if (err) {
				log.error("Error inserting user", toInsert, "Error is:", err);
				return cb_auto(errors.internalServerError);
			}
			cb_auto(null, toInsert);
		});
	};
};
local.signup = function (env) {
	return function (req, resp) {
		if (!req || !req.body || Object.keys(req.body).length === 0) {
			resp.status(403).send("Forbidden");
			return;
		}
		var email = req.body.email.toLowerCase();
		var pass = req.body.pass;
		var save = req.body.save || false;

		async.auto ({
			getUser: private.getUser(env, email),
			createUser: ['getUser', private.createUser(env, email, pass)],
			loginToken: ['getUser', 'createUser', private.loginToken(env, save)],
			verifyEmailToken: ['getUser', 'createUser', private.verifyEmailToken(env)]
		}, function (err, results) {
			if (err) {
				resp.status(err.code).send(err.msg);
				return;
			}
			resp.status(200).json({token: results.loginToken});
		});
	};
};
local.login = function (env) {
	return function (req, resp) {
		// assume I already have my inputs validated through TV4
		var email = req.body.email.toLowerCase();
		var pass = req.body.pass;
		var save = req.body.save || null;

		async.auto ({
			getUser: private.getUser(env, email),
			checkPass: ['getUser', private.checkPass(pass)],
			loginToken: ['getUser', 'checkPass', private.loginToken(env, save)]
		}, function (err, results) {
			if (err) {
				resp.status(err.code).send(err.msg);
				return;
			}
			resp.status(200).json({token: results.loginToken});
		});
	};
};
local.logout = function (env) {
	return function (req, resp) {
		// assume I already have my inputs validated through TV4
		var tkn = req.body.token || null;

		if (!tkn) {
			return resp.status(401).send("Unauthorized");
		}
		tkn = tkn.toLowerCase();

		tokens.check(env, 'login', tkn, function (err, res) {
			if (err) {
				if (err === "TokenExpired") {
					return resp.status(200).json({status: false, reason: err});
				} else {
					return resp.status(501).send("Internal server error");
				}
			}
			tokens.invalidate(env, tkn, function (err, res) {
				if (err) {
					return resp.status(501).send("Internal server error");
				}
				resp.status(200).json({status: true});
			});
		});
	};
};
local.isloggedin = function (env) {
	return function (req, resp) {
		if (!req.body || !req.body.token) {
			log.error ("No body or token:", req.body);
			return resp.status(200).json({status: false});
		}
		var token = req.body.token.toLowerCase();
		tokens.check(env, 'login', token, function (err, user) {
			if (err) {
				if (err === "TokenExpired") {
					return resp.status(200).json({status: false, reason: err});
				} else {
					return resp.status(501).send("Internal server error");
				}
			} else {
				resp.status(200).json({status: true});
			}
		});
	};
};
module.exports = function (env) {
	auth.post("/signup",		local.signup(env));
	auth.post("/login",			local.login(env));
	auth.post("/logout",		local.logout(env));
	auth.post("/isloggedin",	local.isloggedin(env));
	// auth.post("/isadmin",		local.isadmin(env));
	return auth;
};