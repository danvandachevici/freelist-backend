var express 	= require ('express');
var auth 		= express.Router();
var async 		= require ('async');
var uuidLib 	= require ('node-uuid');

var log 		= require ('../lib/log');
var tokens 		= require ('../lib/Tokens');
var list 		= require ('../lib/List');

var private 	= {};
var local 		= {};

private.treat_result = function (resp) {
	return function (err, result) {
		if (err) {
			resp.status(err.code).send(err.msg);
			return;
		}
		resp.status(200).json(result);
	};
};

local.getUserLists = function (env) {
	return function (req, resp) {
		var o = {
			user_id: req.auth.user_id
		};

		list.getUserLists(env, o, private.treat_result(resp));
	};
};
local.getListDetails = function (env) {
	return function (req, resp) {
		var o = {
			user_id: req.auth.user_id,
			list_id: req.body.list_id.toLowerCase()
		};
		list.getListDetails(env, o, private.treat_result(resp));
	};
};
local.createList = function (env) {
	return function (req, resp) {
		var list_name 	= req.body.list_name.toLowerCase();
		var user_id 	= req.auth.user_id;
		var expires 	= req.body.expires || 0;

		var o = {
			list_name: list_name,
			user_id: user_id,
			expires: expires
		};

		list.createList(env, o, private.treat_result(resp));
	};
};
local.deleteList = function (env) {
	return function (req, resp) {
		var o = {
			list_id: req.body.list_id.toLowerCase(),
			user_id: req.auth.user_id
		};

		list.deleteList(env, o, private.treat_result(resp));
	};
};
local.changeList = function (env) {
	return function (req, resp) {
		var o = {
			list_id 		: req.body.list_id.toLowerCase(),
			user_id 		: req.auth.user_id,
			changes 		: req.body.changes || {}
		};

		list.changeList(env, o, private.treat_result(resp));
	};
};
local.shareList = function (env) {
	return function (req, resp) {
		var o = {
			list_id 		: req.body.list_id.toLowerCase(),
			user_id			: req.auth.user_id,
			share_email		: req.body.shareEmail.toLowerCase()
		}

		list.shareList (env, o, private.treat_result(resp));
	};
};
local.addItem = function (env) {
	return function (req, resp) {
		var item 		= req.body.item;
		var listId 		= req.body.listId.toLowerCase();
		var userId 		= req.auth.user_id;
		var o = {
			item: req.body.item,
			list_id: req.body.list_id.toLowerCase(),
			user_id: req.auth.user_id
		};

		list.addItem(env, o, private.treat_result(resp));
	};
};
local.removeItem = function (env) {
	return function (req, resp) {
		var o = {
			item: req.body.item,
			list_id: req.body.list_id.toLowerCase(),
			user_id: req.auth.user_id
		};

		list.removeItem(env, o, private.treat_result(resp));
	};
};
local.changeItem = function (env) {
	return function (req, resp) {
		var o = {
			olditem		: req.body.olditem,
			newitem 	: req.body.newitem,
			list_id 	: req.body.list_id.toLowerCase(),
			user_id 	: req.auth.user_id
		};

		list.changeItem(env, o, private.treat_result(resp));
	}
}
local.finishItem = function (env) {
	return function (req, resp) {
		var o = {
			item 		: req.body.item,
			list_id 	: req.body.list_id.toLowerCase(),
			user_id 	: req.auth.user_id
		};

		list.finishItem(env, o, private.treat_result(resp));
	};
};


module.exports = function (env) {
	auth.post("/getUserLists",			tokens.authenticateMiddleware(env, 'login'), local.getUserLists(env));
	auth.post("/getListDetails",		tokens.authenticateMiddleware(env, 'login'), local.getListDetails(env));
	auth.post("/createList",			tokens.authenticateMiddleware(env, 'login'), local.createList(env));
	auth.post("/deleteList",			tokens.authenticateMiddleware(env, 'login'), local.deleteList(env));
	auth.post("/changeList",			tokens.authenticateMiddleware(env, 'login'), local.changeList(env));
	auth.post("/shareList", 			tokens.authenticateMiddleware(env, 'login'), local.shareList(env));
	auth.post("/addItem",				tokens.authenticateMiddleware(env, 'login'), local.addItem(env));
	auth.post("/removeItem",			tokens.authenticateMiddleware(env, 'login'), local.removeItem(env));
	auth.post("/finishItem",			tokens.authenticateMiddleware(env, 'login'), local.finishItem(env));
	return auth;
};