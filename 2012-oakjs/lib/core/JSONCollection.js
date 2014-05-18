/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
// # `JSONCollection` class.
//
// A `Collection` which loads a set of JSON objects and converts to `Class` instances.
//
// We expect to load a JSON object which:
//	- has a `type` property (so we know which class to instantiate).
//	- has a `data` array of sub-objects, which:
//		- have a `type` property (so we know which class to use to instantiate THEM)
//		- have an `id` property which we'll use to index the data items
//		  (set `JSONCollection.itemIndexKey` to another property if needed).
//
Module.define("oak/lib/core/JSONCollection",
"oak/lib/core/Class,oak/lib/core/Property,oak/lib/core/Collection,oak/lib/core/IndexedList",
function(Class, Property, Collection, IndexedList) {

	var CONSTRUCTOR_REGISTRY = {};

	var JSONCollection = new Class("JSONCollection", "Collection",
//
// instance properties
//
	{
		// A list of items in this collection.
		// NOTE: use `JSONCollection.initData()` to set this up,
		//		 which is called automatically for you in `parseLoadedData()`
		data	: undefined,

		// Expected data type of our items, generally always lowercase.
		// When we parsing items on load, if the item doesn't have a `DATA_TYPE`,
		//	we'll create it using this type.
		_defaultItemType : Property.Constant(undefined),

		// Key which we use to index each of our data items.
		_itemIndexKey : Property.Constant("id"),

		// Set `itemCollectionPointerKey` if you want items
		//	to point back to their collection when they're added.
		//
		//	eg: if you set `_itemCollectionPointerKey` to `"parent"`,
		//		each item will have a pointer back to its collection as `item.parent`.
		//
		// NOTE: If this is set, we'll assume that each item can only be added to a single collection,
		//		 and will throw a warning if you attempt to add the same item to a second collection.
		//
		// See `addItem()`
		_itemCollectionPointerKey : Property.Constant(undefined),

	//
	//	initialization
	//

		// Initialize us with a bunch of properties:
		//	- all top-level properties in properties will be added directly to this object
		//	- we'll call `initData(properties.data)` to initialize the list of items passed in.
		//		- if `properties.data` is empty, this will just clear our data.
		//		- if it's not empty, we'll instantiate the items as `JSONData` instances.
		//
		// NOTE: we deliberately do NOT call superclass method, as we work a little differently...
		init : function(properties) {
			this.extend(properties);
			this.initData(this.data);
		},

		// Add all items into our data array.
		// Ensures all child items are instantiated as JSONData instances.
		initData : function(items) {
			// indexed list of items
			this.data = new IndexedList(this._itemIndexKey);

			// forget it if we didn't get any data
			if (items == null) return;

			// make sure everyone in the list is a Cohort
			var item, i = -1;
			while(item = items[++i]) {
				// call initItem, which may transform the type from JSON to a class instance
				item = this.initItem(item);
				if (item) this.addItem(item);
			}
		},

		// Given a generic item, inspect its `datatype` and instantiate it as a Class instance.
		// If the item is already a Class, just returns it.
		// If we can't find a constructor for it, returns `undefined`.
		initItem : function(item) {
			// if it's already a class instance, just return it.
			if (item instanceof Class) return item;

			var constructor = this.getConstructorForItem(item);
			if (!constructor) {
				console.warn(this,".initItem(): no constructor for ",item);
			} else {
				return new constructor(item);
			}
		},


		// Return the constructor used to instantiate a POJO.
		getConstructorForItem : function(item) {
			var constructor;
			// If item specifies a "datatype", try that.
			if (item.type) constructor = JSONCollection.getConstructorForType(item.type);
			// Try our _defaultItemType
			if (!constructor) constructor = JSONCollection.getConstructorForType(this._defaultItemType);
			return constructor;
		},

		// Add an initialized item to our list of items.
		addItem : function(item) {
			// add it to our data
			this.data.add(item);

			// if `itemCollectionPointer` is set, point the item back to us.
			var key = this.itemCollectionPointerKey;
			if (key) {
				// if it's already pointing to us, forget it
				if (item[key] === this) return;
				// if it's pointing to something else, log a warning
				if (item[key] !== null) {
					console.warn(this,".addItem(",item,"): `item."+key+"` already set to ",item[key]);
				}
				// add in a non-enumerable fashion!
				Object.defineProperty(item, key, {
					value 			: this,
					enumerable		: false,	// not visible in `item.keys()`
					configurable	: true,		// allows us to change it later via another `addItem()` call
					writeable		: false		// attempting to set it with `=` won't work.
				});
			}
		},

	//
	//	loading
	//

		// Return a promise which will fetch the JSON data.
		// The results will be parsed via `parseLoadedResults()` below.
		getLoader : function() {
			throw "You must override "+this.constructor.className+".getLoader()!";
		},

		// Parse the data sent back from the server.
		parseLoadedResults : function(JSONdata) {
			this.init(JSONdata);
			return [this.data];
		}

	},

//
// class properties
//
	{
		// Data type(s) for this JSONCollection, in addition to our Class name.
		// Set this to a string or array of strings to associate different
		//	logical types with this data type.  See `registerConstructor`.
		_types : Property.Constant(undefined),

		// Register the data type(s) for this dataset when the class is created.
		initClass : function() {
			this.registerConstructor(this, this._types);
		},

		// Registry of item or dataSet `datatype` to constructor function for that type.
		// Set up automatically as JSONData/JSONCollection classes are created.
		CONSTRUCTOR_REGISTRY : Property.Constant(CONSTRUCTOR_REGISTRY),

		// Given a JSON data type, return the constructor for it.
		// Returns `undefined` if we didn't fine one.
		getConstructorForType : function(type) {
			return this.CONSTRUCTOR_REGISTRY[type];
		},

		// Register a constructor for a specific dataType.
		registerConstructor : function(constructor, dataTypes) {
			var registry = CONSTRUCTOR_REGISTRY;

			// automatically add by constructor's class name
			registry[constructor.id] = constructor;

			// if they passed any dataTypes, add them
			if (!dataTypes) return;
			if (!Array.isArray(dataTypes)) dataTypes = [dataTypes];
			dataTypes.forEach(function(dataType) {
				registry[dataType] = constructor;
			});
		},

	});	// end new Class("JSONCollection")

	return JSONCollection;

});	// end define("oak/lib/core/JSONCollection")
