/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	IndexedList data structure:
//		An ordered list that also maintains a "map" of items via some key defined on each item.
//		Note: null items will NOT be added to the list.
//
//		Initialize the list with the name of the 'key' property on each item to be added to the list.
//		For example, if your items should be indexed by their 'id' property, create the list like so:
//			new IndexedList("id")
//		You can pass a function to be used to get the item value if that makes more sense, eg:
//			function getItemKey(item){if (item != null) return someMethod(item); }
//			new IndexedList(getItemKey);
//
//		You can access the items in the list in order via normal list semantics, eg:
//			`list[index]`  or   `list.forEach(...)`
//		You can also access items as a map via their `key`, eg:
//			`list.MAP[someKeyValue]`
//
//		NOTE: you MUST NOT assign directly into the IndexedList, or the MAP will not get updated.
//			Use one of the following instead:
//			- prepend()
//			- append() (a.k.a. "add()")
//			- remove()
//			- removeAll()
//			- shift()
//			- etc.
//		Or you can make copies of the list with:
//			- slice()
//			- clone()
//			- etc.
//
//		NOTE: null entries in the list will NOT be added to the map.
//
Module.define("oak/lib/core/IndexedList",
"oak/lib/js/Array,oak/lib/core/Class,oak/lib/core/Property",
function(Array, Class, Property) {

	// constructor
	function IndexedList(childKeyProperty) {
		if (!childKeyProperty) throw "new IndexedList(): you must pass a child key property!";
		var list = [];

		// add MAP and child key property name
		var instanceProperties = {
			MAP						: Property.Hidden({}),
			__childKeyProperty__	: Property.Hidden(childKeyProperty)
		}
		Object.defineProperties(list, instanceProperties);

		// GRR, you can't subclass array, so we have to add properties manually.
		Object.defineProperties(list, IndexedList.methods);

		return list;
	}

	var AP = Array.prototype;

	// Return a Property which yields an array mutator method (eg: pop or shift) to update our MAP.
	// NOTE: this is not terribly efficient
	function wrapArrayMutator (methodName) {
		var arrayMethod = AP[methodName];
		return new Property.Hidden(function() {
			var returnValue = arrayMethod.apply(this, arguments);
			rebuildMap(this);
			return returnValue;
		});
	};

	// Return a Property which yields an array method which returns a duplicate or subset of the array.
	function wrapArrayDuplicator (methodName) {
		var arrayMethod = AP[methodName];
		return new Property.Hidden(function() {
			// call the original method, which will return a subset of the array
			var results = arrayMethod.apply(this, arguments);
			var clone = this.__emptyClone__();
			clone.push.apply(clone, results);
			return clone;
		});
	};

	// Rebuild the map for a list.
	// Also eliminates null items from the list.
	function rebuildMap(list) {
		list.MAP = {};
		var i = list.length, item;
		while (--i >= 0) {
			item = list[i];
			// remove null items from the array
			if (item == null) {
				AP.splice.call(list, i, 1);
			}
			// or add it to the MAP if not null and key is not null
			else {
				var key = keyForItem(list, item);
				if (key != null) list.MAP[key] = item;
			}
		}
	}

	// Given an item to add to the list, return the key to store the item under.
	// By default we just use the '__childKeyProperty__' defined when you create the IndexedList.
	function keyForItem(list, item) {
		if (!item) return null;
		if (typeof item[list.__childKeyProperty__] === "function") {
			return item[list.__childKeyProperty__]();
		} else {
			return item[list.__childKeyProperty__];
		}
	}

	// GRR, you can't subclass array, so we have to add methods to each instance!
	IndexedList.methods = {
		// return an empty clone of this list
		__emptyClone__ : new Property.Hidden(function() {
			return new IndexedList(this.__childKeyProperty__);
		}),

		// special case `push` since it's the base of many, many other frequently used things
		push : Property.Hidden(function(item1, item2, etc) {
			var newLength = AP.push.apply(this, arguments);
			for (var i = 0, last = arguments.length; i < last; i++) {
				var item = arguments[i];
				var key = keyForItem(this, item);
				if (key) this.MAP[key] = item;
			}
			return newLength;
		}),

		// special case `splice` since it's the base of other frequently used things (like `remove`)
		splice : Property.Hidden(function(index, howMany, item1, item2, etc) {
			var removed = AP.splice.apply(this, arguments);
			// pull everything that was removed out of our MAP
			for (var i = 0, last = removed.length; i < last; i++) {
				var key = keyForItem(this, removed[i]);
				if (key) delete this.MAP[key];
			}
			// add everything that was added to our MAP
			for (var i = 2, last = arguments.length; i < last; i++) {
				var item = arguments[i];
				var key = keyForItem(this, item);
				if (key) this.MAP[key] = item;
			}
			return removed;
		}),

		// wrap standard array mutator methods which change the list of items in the array
		pop : wrapArrayMutator("pop"),
		shift : wrapArrayMutator("shift"),
		unshift : wrapArrayMutator("unshift"),

		// wrap standard array methods which return subsets of the array
		slice : wrapArrayDuplicator("slice"),
		filter : wrapArrayDuplicator("filter"),

		// custom concat method (wierd signature)
		concat : new Property.Hidden(function() {
			var newArray = AP.concat.apply(this, arguments);
			var clone = this.__emptyClone__();
			clone.push.apply(clone, newArray);
			return clone;
		}),

		// Return a clone of the list as a plain Javascript array
		toArray : function() {
			return [].concat(this);
		}
	}

	return Class.register(IndexedList, "IndexedList");
});	//	end define("oak/lib/core/IndexedList")
