/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
// # `JSONData` class.
//
// A bunch of JSONData instantiated as a class.
//
//  These will generally be created for you as part of a `JSONCollection`.
//	See that class for details of the loading pattern.
//
// Instances of data should be a subclass of `JSONData`.
//		- it must have a "datatype" property (so we know which class to instantiate on load).
//		- ideally, the only enumerable properties of the class will be properties set
//			from our initializing JSON object, or derived properties.
//			If this is the case, you can use  `datum.getDataKeys()` to return the set of values
//			which you were initialized with.
//
Module.define("oak/lib/core/JSONData",
"oak/lib/core/Class,oak/lib/core/Property,oak/lib/core/JSONCollection",
function(Class, Property, JSONCollection) {

	// A piece of data to be initialized from a JSON object.
	// Often you'll set a bunch of properties directly from the JSON,
	//	and then represent a bunch of other derived properties as Getters.
	//
	// Use `getDataKeys()` to get values set directly on the object (ignoring getters and methods).
	//
	// NOTE: Optimally, the only enumerable keys on your JSONData will be the actual data values.
	var JSONData = new Class("JSONData",
	//
	// instance properties
	//
	{

		// Return keys for the data set directly on this datum, ignoring derived properties and methods.
		// If you've set your datum class up as above, this will be just the data you were initialized with.
		getDataKeys : Property.Hidden(function() {
			var keys = [];
			for (var key in this) {
				if (!this.hasOwnProperty(key)) 					continue;
				if (typeof this[key] === "function") 			continue;
				if (this.__lookupGetter__(key) !== undefined) 	continue;
				keys.append(key);
			}
			return keys;
		}),

		// Return a POJO of our initialization data, assuming you've set your datum class up as above.
		getData : Property.Hidden(function() {
			var output = {};
			this.getDataKeys().forEach(function(key) {
				output[key] = this[key];
			}, this);
			return output;
		}),

	},
//
//	class properties
//
	{
		// Data type(s) for this JSONData, in addition to our Class name.
		// Set this to a string or array of strings to associate different
		//	logical types with this data type.  See `JSONCollection.registerConstructor`.
		_types : undefined,

		// Register the data type(s) for this dataset when the class is created.
		initClass : function() {
			JSONCollection.registerConstructor(this, this._types);
		},

	});	// end new Class("JSONData")

	return JSONData;
});	// end define("oak/lib/core/JSONData")
