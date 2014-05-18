/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Array extensions
//

Module.define("oak/lib/js/Array", "oak/lib/js/Object", function() {
	Property.patch(Array.prototype, {
		// Return an empty clone of this array.
		// Although this seems non-sensical, it's useful for array subclasses.
		__emptyClone__ : function() {
			return [];
		},

		// Are we empty?
		isEmpty : Property.Getter(function() { return this.length == 0 }, {enumerable:false}),

		// Return a clone of this array.
		clone : function() {
			var clone = this.__emptyClone__();
			clone.append.apply(clone, this);
			return clone;
		},

		// syntactic sugar since "unshift" is so unsightly and "push" is non-standard in api terms
		prepend : function() {
			this.unshift.apply(this, arguments);
			return this;
		},

		// Syntactic sugar for "push" or "add-at-the-end", except it returns the full array.
		append  : function(){
			this.push.apply(this, arguments);
			return this;
		},

		// Syntactic sugar for "push" or "add-at-the-end", except it returns the full array.
		add  : function(){
			this.push.apply(this, arguments);
			return this;
		},

		// Add a list of items to the end of our array.
		// NOTE: this is different from concat, in that it modifies the list in place.
		// Returns this array.
		addList : function(list) {
			if (list && list.length > 0) {
				var args = [this.length, 0].concat(list);
				this.splice.apply(this, args);
			}
			return this;
		},

		// Return the last item in the array.
		// Returns undefined if the array is empty.
		last : function() {
			return this[this.length-1];
		},

		// Return index of some item in this array.  (Not defined on some older browsers).
		indexOf : function indexOf(it) {
			var i = -1, len = this.length;
			while (++i < len) {
				if (this[i] == it) return i;
			}
			return -1;
		},

		// Return true if this array contains some item.
		contains : function contains(it) {
			return this.indexOf(it) > -1;
		},

		// Sort a set of objects by a string property, case INsensitive
		sortByProperty : function (propertyName, defaultValue) {
			function compare(a, b) {
				a = a[propertyName];
				b = b[propertyName];

				if (a == null) a = defaultValue;
				else if (typeof a === "string") a = a.toLowerCase();

				if (b == null) b = defaultValue;
				if (typeof b === "string") b = b.toLowerCase();

				if (a < b) return -1;
				if (a > b) return 1;
				return 0;
			}
			return this.sort(compare);
		},

		// Sort case INSENSITIVE by two separate properties.  No defaulting.
		sortByProperties : function(property1, property2, etc) {
			var properties = Function.args();
			function compare(a, b) {
				var i = -1, property;
				while (property = properties[++i]) {
					var aValue = a[property];
					if (typeof aValue === "string") aValue = aValue.toLowerCase();

					var bValue = b[property];
					if (typeof bValue === "string") bValue = bValue.toLowerCase();

					if (aValue < bValue) return -1;
					if (aValue > bValue) return 1;
				}
				return 0;
			}
			return this.sort(compare);
		},

		// Remove all occurances of one or more items from this array.
		remove : function remove(item1, item2, etc) {
			var a = arguments.length;
			while (--a >= 0) {
				var it = arguments[a], i = this.length;
				while (--i >= 0) {
					if (this[i] === it) this.splice(i, 1);
				}
			}
			return this;
		},

		// Remove all occurances of items from this array where callback returns true.
		// (Similar to filter, but modifies the array).
		removeWhere : function remove(callback, scope) {
			var array = Object(this);
			var length = array.length >>> 0;
			if (typeof callback != "function") {
				throw new TypeError(callback + " is not a function");
			}
			if (!scope) scope = window;
			for (var i = length-1; i >= 0; i--) {
				if (i in array) {
					if (callback.call(scope, array[i], i, array)) {
						array.splice(i, 1);
					}
				}
			}
			return this;
		},

		// Empty everything out of the array.
		empty : function() {
			this.splice(0, this.length);
		},


		// Peek at the top-most element in the array.
		//	 (eg:  'peek' vs 'pop' in classical algorithms)
		peek : function peek() {
			return this[this.length - 1];
		},


		// Return a randomized copy of an array.
		randomize : function randomize() {
			var copy = [].concat(this),
				randomized = this.clone()
			;
			while (copy.length) {
				randomized.add(copy.splice(copy.length.random(), 1)[0]);
			}
			return randomized;
		},

		// Return a random item from the array.
		random : function() {
			return this[this.length.random()];
		},

		// from	 https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/every
		every : function(fun /*, thisp */) {
			if (this === void 0 || this === null) throw new TypeError();
			var t = Object(this);
			var len = t.length >>> 0;
			if (typeof fun !== "function") throw new TypeError();

			var thisp = arguments[1];
			for (var i = 0; i < len; i++) {
				if (i in t && !fun.call(thisp, t[i], i, t)) return false;
			}
			return true;
		},

		// from		https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/map
		forEach : function(callback, scope) {
			var index, length;
			if (this == null) throw new TypeError("this is null or not defined");
			var O = Object(this);
			var length = O.length >>> 0;
			if ({}.toString.call(callback) != "[object Function]") {
				throw new TypeError(callback + " is not a function");
			}
			if (!scope) scope = window;
			index = 0;
			while(index < length) {
				var value, mappedValue;
				if (index in O) {
					value = O[index];
					callback.call(scope, value, index, O);
				}
				index++;
			}
		},

		// from		https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/map
		map : function(callback, scope) {
			var results, index, length;
			if (this == null) throw new TypeError("this is null or not defined");
			var O = Object(this);
			var length = O.length >>> 0;
			if ({}.toString.call(callback) != "[object Function]") {
				throw new TypeError(callback + " is not a function");
			}
			if (!scope) scope = window;
			results = new Array(length);
			index = 0;
			while(index < length) {
				var value, mappedValue;
				if (index in O) {
					value = O[index];
					mappedValue = callback.call(scope, value, index, O);
					results[ index ] = mappedValue;
				}
				index++;
			}
			return results;
		},

		// from		https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/filter
		filter : function(callback, scope) {
			var index, length;
			if (this == null) throw new TypeError("this is null or not defined");
			var O = Object(this);
			var length = O.length >>> 0;
			if (typeof callback != "function") {
				throw new TypeError(callback + " is not a function");
			}
			if (!scope) scope = window;
			var result = this.__emptyClone__();
			for (var i = 0; i < length; i++) {
				if (i in O) {
					var value = O[i];	// in case callback mutates this
					if (callback.call(scope, value, i, O)) {
						result.push(value);
					}
				}
			}
			return result;
		},

		// Return a new array based on this list, but with all `null` entries removed.
		trim : function() {
			return this.filter(function(it){return it != null});
		},

		// Return a flattened copy of this list (all sub-lists appended into a single array).
		flatten : function() {
			return this.concat.apply(this.__emptyClone__(),this);
		},

		// Add another list of items to the end of this list.  Skips null entries in otherList.
		// NOTE: this works with array-like-things (eg: arguments) as well as normal arrays.
		appendList : function(otherList) {
			for (var i = 0; i < otherList.length; i++) {
				var it = otherList[i];
				if (it != null) this.push(it);
			}
			return this;
		},

		// Return an array of a given property for each item in the list.
		//	If the item is null or doesn't have that property, that item's value will be undefined.
		getProperty : function(propertyName) {
			var i = this.length, item, values = [];
			while (--i >= 0) {
				values[i] = (this[i] ? this[i][propertyName] : undefined);
			}
			return values;
		},

		// Return the subset of this array whose properties match those passed in.
		matching : function(properties) {
			var matching = this.__emptyClone__();
			var i = -1, len = this.length, it;
			while (++i < len) {
				it = this[i]
				if (it != null) {
					var matches = true;
					for (var key in properties) {
						if (it[key] != properties[key]) {
							matches = false;
							break;
						}
					}
					if (matches) matching.append(it);
				}
			}
			return matching;
		},

		// Return all items in this array with duplicates removed.
		// Also removes null items.
		unique : function() {
			var results = this.__emptyClone__();
			var i = -1, len = this.length, it;
			while (++i < len) {
				it = this[++i];
				if (it != null && !results.contains(it)) results.append(it);
			}
			return results;
		},

	});

	return Array;
});	// end define("oak/lib/js/Array")
