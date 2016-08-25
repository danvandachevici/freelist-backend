var errors 		= require ('./Errors');
var log 		= require ('./log');
var uuidLib 	= require ('node-uuid');

var list 		= {};
var $ = {};

$.ownListQuery = function (user_id, list_id) {
	var q = {
		_id: list_id,
		owner: user_id
	};
	return q;
}
$.ownOrSharedListQuery = function (user_id, list_id) {
	var q1 = {
		owner: user_id
	};
	var q2 = {
		shared: {
			$in: [user_id]
		}
	};
	var q = {
		_id: list_id,
		$or: [q1, q2]
	}
	return q;
};

list.getUserLists = function (env, o, cb) {
	var q1 = {
		owner: o.user_id
	};
	var q2 = {
		shared: {
			$in: [o.user_id]
		}
	};
	var q = {
		$or: [q1, q2]
	}
	env.mongo_freelist.list_details.find(q).toArray(function (err, arr) {
		if (err) {
			log.error("Error finding lists:", err);
			return cb(errors.internalServerError);
		}
		var ret = arr.map(function (el, idx, arr) {
			el.list_id = el._id;
			delete el._id;
			return el;
		});
		cb(null, ret);
	});
};

list.createList = function (env, o, cb) {

	env.mongo_freelist.list_details.findOne({name: o.list_name, user_id: o.user_id}, function (err, doc) {
		if (err) {
			log.error("Error finding list:", err);
			return cb(erros.internalServerError);
		}
		if (doc) {
			log.error("List already exists")
			cb(null, {status: false, reason: "List already exists"});
		}
		var list_id = uuidLib.v4().toLowerCase();
		var newdoc = {
			_id: list_id,
			name: o.list_name,
			expires: o.expires,
			owner: o.user_id,
			shared: []
		};
		env.mongo_freelist.list_details.insertOne(newdoc, function (err, inserted) {
			if (err) {
				log.error ("Error inserting list:", err);
				return cb(errors.internalServerError);
			}
			cb(null, {status: true});
		});
	});
};

list.deleteList = function (env, o, cb) {
	var q = $.ownOrSharedListQuery(o.user_id, o.list_id);

	env.mongo_freelist.list_details.findOne(q, function (err, doc) {
		if (err) {
			log.error ("Error finding list:", err);
			return cb(errors.internalServerError);
		}
		if (!doc) {
			log.error ("List not found:", q);
			return cb(errors.forbidden);
		}
		if (doc.owner === o.user_id) {
			// this list is mine, I can remove it.
			env.mongo_freelist.list_details.remove({_id: doc._id}, function (err) {
				if (err) {
					log.error ("Error removing list:", err);
					return cb(errors.internalServerError);
				}
				cb(null, {status: true});
			});
		} else {
			// this list is shared with me, so I can remove my id from the shared object
			env.mongo_freelist.list_details.update({_id: doc._id}, {$pull: {shared: o.user_id}}, function (err, updated) {
				if (err) {
					log.error ("Error removing shared list:", err);
					return cb(errors.internalServerError);
				}
				cb(null, {status: true});
			});
		}
	});
};

list.changeList = function (env, o, cb) {
	var q = $.ownListQuery(o.user_id, o.list_id);
	env.mongo_freelist.list_details.findOne(q, function (err, doc) {
		if (err) {
			log.error ("Error finding list:", err);
			return cb(errors.internalServerError);
		}
		if (!doc) {
			
		}

		var up = {$set: {}};
		var id = doc._id;
		delete doc._id;
		for (var key in o.changes) {
			if (doc[key]) {
				up.$set[key] = o.changes[key];
			}
		}
		env.mongo_freelist.list_details.updateOne({_id: id}, up, function (err, updated) {
			if (err) {
				log.error ("Error finding list:", err);
				return cb(errors.internalServerError);
			}
			cb(null, {status: true});
		});
	});
};

list.shareList = function (env, o, cb) {
	var q = $.ownListQuery(o.user_id, o.list_id);
	env.mongo_freelist.list_details.findOne(q, function (err, listObj) {
		if (err) {
			log.error("Error finding list", err);
			return cb(errors.internalServerError);
		}
		if (!listObj) {
			log.error ("Error finding list:", err);
			return cb(errors.forbidden);
		}
		env.mongo_freelist.users.findOne({email: o.share_email}, function (err, userObj) {
			if (err) {
				log.error ("Error finding user:", err);
				return cb(errors.internalServerError);
			}
			if (!userObj) {
				log.error ("user not found:", q);
				return cb(null, {status: false, reason: "User email not found"});
			}

			var q = {owner: o.user_id, _id: o.list_id};
			var up = {
				$push: {shared: userObj._id}
			};
			env.mongo_freelist.list_details.update(q, up, function (err, updated) {
				if (err) {
					log.error ("Error updating list:", err);
					return cb(errors.internalServerError);
				}
				cb(null, {status: true});
			});
		});
	});
};

list.addItem = function (env, o, cb) {
	var q = $.ownOrSharedListQuery(o.user_id, o.list_id);
	env.mongo_freelist.list_details.findOne(q, function (err, doc) {
		if (err) {
			log.error ("Error finding list:", err);
			return cb(errors.internalServerError);
		}
		if (!doc) {
			log.error ("List not found:", q);
			return cb(errors.forbidden);
		}
			// check if item exists;
		var upd = {
			$inc: {},
			$set: {}
		};
		var itemname = o.item.name.toLowerCase();
		var itemunit = o.item.unit.toLowerCase();
		var q = {item_id: itemname, unit: itemunit, list_id: o.list_id};
		upd.$inc.qty = o.item.qty;
		upd.$set.touched_by = o.user_id;
		upd.$set.checked = false;
		env.mongo_freelist.lists.updateOne(q, upd, {upsert: true}, function (err, updated) {
			if (err) {
				log.error ("Error updating list:", err);
				return cb(errors.internalServerError);
			}
			cb(null, {status: true});
		});
	});
};

list.removeItem = function (env, o, cb) {
	var q = $.ownOrSharedListQuery(o.user_id, o.list_id);
	env.mongo_freelist.list_details.findOne(q, function (err, doc) {
		if (err) {
			log.error ("Error finding list:", err);
			return cb(errors.internalServerError);
		}
		if (!doc) {
			log.error ("List not found:", q);
			return cb(errors.forbidden);
		}
		var itemname = o.item.name.toLowerCase();
		var itemunit = o.item.unit.toLowerCase();
		var q = {item_id: itemname, unit: itemunit, list_id: o.list_id};
		env.mongo_freelist.lists.remove(q, function (err, removed) {
			if (err) {
				log.error ("Error removing item:", err);
				return cb(errors.internalServerError);
			}
			cb(null, {status: true});
		});
	});
};

list.changeItem = function (env, o, cb) {
	var q = $.ownOrSharedListQuery(o.user_id, o.list_id);
	env.mongo_freelist.list_details.findOne(q, function (err, doc) {
		if (err) {
			log.error ("Error finding list:", err);
			return cb(errors.internalServerError);
		}
		if (!doc) {
			log.error ("List not found:", q);
			return cb(errors.forbidden);
		}
		var itemname = o.olditem.name.toLowerCase();
		var itemunit = o.olditem.unit.toLowerCase();
		var q = {item_id: itemname, unit: itemunit, list_id: o.list_id};
		var upd = {
			$set: {
				qty: o.newitem.qty,
				name: o.newitem.name,
				list_id: o.newitem.list_id
			}
		};
		env.mongo_freelist.lists.updateOne(q, upd, function (err, updated){
			if (err) {
				log.error ("Error updating item:", err);
				return cb(errors.internalServerError);
			}
			cb(null, {status: true});
		});
	});
};

list.finishItem = function (env, o, cb) {
	var q = $.ownOrSharedListQuery(o.user_id, o.list_id);
	env.mongo_freelist.list_details.findOne(q, function (err, doc) {
		if (err) {
			log.error ("Error finding list:", err);
			return cb(errors.internalServerError);
		}
		if (!doc) {
			log.error ("List not found:", q);
			return cb(errors.forbidden);
		}
		var itemname = o.item.name.toLowerCase();
		var itemunit = o.item.unit.toLowerCase();
		var q = {item_id: itemname, unit: itemunit, list_id: o.list_id};
		var upd = {
			$set: {
				checked: o.item.checked
			}
		};
		env.mongo_freelist.lists.updateOne(q, upd, function (err, updated){
			if (err) {
				log.error ("Error updating item:", err);
				return cb(errors.internalServerError);
			}
			cb(null, {status: true});
		});
	});
};

module.exports = list;