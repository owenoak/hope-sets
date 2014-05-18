/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	OrderedMap data structure:
//		An ordered map is a simple map which also maintains an ordered list of keys.
//		Access the ordered keys as    					map.KEYS
//		Figure out the number of items in the lis as:	map.KEYS.length
//
//		Note that you can also do a for...in to do an UNORDERED traversal through the map keys as well
//			(the "keys" property and instance methods are not enumerable)
//
//		NOTE: you MUST use only the following methods to add/remove from the map or it will get be out of sync!
//			- add()
//			- remove()
//
Module.define("oak/lib/core/OrderedMap",
"oak/lib/core/Class,oak/lib/js/Array,oak/lib/js/String",
function(Class, Array, String) {
	function OrderedMap() {
		Property.patch(this, {
			KEYS : []
		});
	}
	Property.patch(OrderedMap.prototype, {
		// Add a key/value pair to the map.
		addProperty : function(key, value) {
			this[key] = value;
			if (!this.KEYS.contains(key)) this.KEYS.add(key);
		},

		// Remove the a value from the map by key.
		removeProperty : function(key) {
			delete this[key];
			this.KEYS.remove(key);
		},

		// Iterate through the keys of the list in order.
		//	Your method will be called with   (key, value, index)
		forEach : function(method, scope) {
			if (!scope) scope = window;
			var i = -1, length = this.KEYS.length;
			while (++i < length) {
				var key = this.KEYS[i], value = this[key];
				method.call(scope, value, key, this);
			}
		},

		// sort keys in case INSENSITIVE fashion
		sortKeys : function() {
			String.sortStringArray(this.KEYS);
		},

		// return the items in this map as an array (in current sort order)
		toArray : function() {
			var list = [], keys = this.KEYS, key, i = -1;
			while (key = keys[++i]) {
				list[i] = this[key];
			}
			return list;
		},

		// Return an identifying string for this class (for reflection).
		toString : function() {
			return "[an orderedMap]";
		}
	});


	// Class-level methods.
	Property.extend(OrderedMap, {

		// Extend properties from this map to another map in order.
		extend : function(otherMap) {
			this.forEach(function(value, key) {
				otherMap.addProperty(value, key);
			});
		},

		// Given some thing, return an orderedMap of a sub-set of the thing's properties.
		// If `thing[key] == null`, we'll not put it in the output map.
		getProperties : function(thing, keys) {
			var properties = new OrderedMap();
			if (!thing || !keys) return properties;
			if (typeof keys === "string") keys = keys.split(",");
			var i = -1, key, value;
			while (key = keys[++i]) {
				value = thing[key];
				if (value != null) properties.addProperty(key, value);
			}
			return properties;
		}
	});

	return Class.register(OrderedMap, "OrderedMap");
});	//	end define("oak/lib/core/OrderedMap")
