/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Object extensions.
//

Module.define("oak/lib/js/Object",
"oak/lib/core/Property",
function(Property) {
	// Shim in ECMAScript Object.defineProperty() so we can use it below.
	//	Note: if this shim is used, we will NOT be able to make properties non-enumerable or non-configurable!
	if (!Object.defineProperty) {
		// if __defineGetter__ is not available on an empty object, this won't work!
		if (!{}.__defineGetter__) throw "Browser.js: can't define Object.defineProperty because __defineGetter__ method not found";

		// warn that while we can use defineProperty, it won't make things non-enumerable
		console.warn("(Browser.js): Object.defineProperty is patched, but cannot make non-enumerable properties");

		// ECMAScript Object.defineProperty()
		Object.defineProperty = function(it, property, descriptor) {
			if (!it) return;
			if (descriptor.value) {
				it[property] = descriptor.value;
				return;
			}
			if (!it.__defineGetter__) {
				console.warn("Object.defineProperty(): __defineGetter__ not defined so this won't work");
				return;
			}
			if (descriptor.get) it.__defineGetter__(property, descriptor.get);
			if (descriptor.set) it.__defineSetter__(property, descriptor.set);
		}
	}


	// Shim in ECMAScript Object.defineProperties().
	//	See note in Object.defineProperties().
	if (!Object.defineProperties) {
		Object.defineProperties = function(object, properties) {
			for (key in properties) {
				Object.defineProperty(object, properties[key]);
			}
		}
	}

	// Shim in ECMAScript Object.getPrototypeOf().
	if (!Object.getPrototypeOf) {
		Object.getPrototypeOf = function(object) {
			if (!object) return undefined;
			return (object.__proto__ || object.constructor.prototype);
		}
	}


	//
	// Add methods to Object
	//
	Property.patch(Object, {
		// Assign a property to an object in a non-changeable way.
		setReadOnlyProperty : function(it, key, value) {
			Object.defineProperty(it, key, { value: value, enumerable:true, configurable:false, writable:false});
		},

		// ECMAScript Object.keys()
		keys : function(it) {
			var keys = [];
			if (it) for (var key in it) keys.push(key);
			return keys;
		},

		// Convert all of an object's enumerable property values to an array.
		// NOTE: in some javascript environments, the order will be the same as
		//		 the order of addition of the properties.  In some it will be random.
		toArray : function(it) {
			var values = [];
			if (it) for (key in it) values.push(it[key]);
			return values;
		},

		// Return ALL property names of an object, INCLUDING NON-ENUMERABLE PROPERTIES.
		getAllPropertyNames : function(thing) {
			var allProps = [];
			while (thing) {
				Object.getOwnPropertyNames(thing).forEach(function(prop) {
					if (!allProps.contains(prop)) allProps.append(prop);
				});
				thing = Object.getPrototypeOf(thing);
			}
			return allProps;
		},

		// Return the prototype chain for a thing, INCLUDING THE THING ITSELF,
		//	with the thing as the FIRST element
		getPrototypeChain : function(thing) {
			var protos = [];
			var proto = thing;
			while (proto) {
				protos.push(proto);
				if (proto.constructor !== Object && proto != proto.constructor.prototype) {
					proto = proto.constructor.prototype;
				} else {
					proto = null;
				}
			}
			return protos;
		},

		// Given some thing, call method(thing, thing.proto) for each item
		//	in thing's prototype chain, including for thing itself.
		//
		// Returns an array of results.
		//
		//	NOTE: the method will be called on the earliest prototype which defines the method FIRST.
		recurseUpPrototypeChain : function(thing, method) {
			var results = [];
			if (thing && method) {
				// get the prototype chain in REVERSE order
				//	so results from this thing will override those from parents
				var protos = Object.getPrototypeChain(thing);
				protos = protos.reverse();
				while (protos.length) {
					var proto = protos.shift();
					results.push(method.apply(thing, [thing, proto]));
				}
			}
			return results;
		},

		// Recurse up the prototype chain for some object, merging a list property specified by key
		//	(eg: the 'events' map in Widget).
		// If the merged list has no items, we return undefined,
		getMergedProtoChainList : function(thing, key, unique, startList) {
			var results = [];
			if (startList) results = results.concat(startList);
			Object.recurseUpPrototypeChain(thing, function(thing, proto) {
				if (!proto || !proto.hasOwnProperty(key)) return;
				var list = proto[key];
				if (list && list.forEach) {
					list.forEach(function(it) {
						if (unique && results.contains(it)) return;
						results.append(it);
					});
				}
			});
			if (results.length) return results;
			return undefined;
		},

		// Recurse up the prototype chain for some object, merging a map property specified by key.
		//	(eg: the 'parts' map in Widget).
		// If the merged map has no properties, we return undefined.
		getMergedProtoChainMap : function(thing, key, removeUndefined, startMap) {
			var results = {};
			if (startMap) {
				for (startKey in startMap) {
					var value = startMap[startKey];
					if (value !== undefined) results[startKey]= value;
				}
			}
			Object.recurseUpPrototypeChain(thing, function(thing, proto) {
				if (!proto || !proto.hasOwnProperty(key)) return;
				var map = proto[key];
				if (map) {
					for (var prop in map) {
						var value = map[prop];
						if (removeUndefined && value === undefined) {
							delete results[prop];
						} else {
							results[prop] = value;
						}
					}
				}
			});

			// if the merged map has no properties, we want to return undefined.
			// so do a for key in... and return immediately if there's at least one property.
			for (key in results) {
				return results;
			}
			return undefined;
		},

		// Add a non-enumerable "asSuperclass" property, which allows you to call some method on a "Superclass" object.
		// NOTE: we assume the property will be extend()ed into some other object sometime.
		createAsMethod : function (zuperName, zuper, recipient) {
			if (!recipient) recipient = zuper;
			var asMethodName = "as"+zuperName;
			recipient[asMethodName] = Property.Hidden(function asMethod(methodName, args) {
				// if no args provided, take them from the calling function
				if (arguments.length === 1 && asMethod.caller) args = asMethod.caller.arguments;
				var method = zuper[methodName];
				if (typeof method !== "function") {
					return console.error(this,".as"+zuperName+"('",methodName,"'): method not found!");
				}
				return method.apply(this, args);
			});
		}
	});

	return Object;
});	// end define("oak/lib/js/Object")
