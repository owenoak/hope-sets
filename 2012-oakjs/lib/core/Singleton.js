/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Singleton object creator.
//

Module.define("oak/lib/core/Singleton",
"oak/lib/core/Property,oak/lib/core/Class,oak/lib/core/Mixin,oak/lib/core/Soonable,oak/lib/core/Bindable",
function(Property, Class, Mixin, Soonable, Bindable) {

	// @singletonName:		(global) name of the singleton
	// @mixins:				optional list of mixin names to apply
	// @properties:			optional bag of properties to apply to the singleton
	function Singleton(singletonName, properties) {
		if (Class.debug) console.group("(Class.js):  new Singleton(",arguments,")");

		// NOTE: in order for Firefox and WebKit to show a meaningful representation of the singleton
		//			we eval() up a constructor function with the correct name.
		var constructor;
		eval("constructor = function "+singletonName+"(){}");

		// create singleton as an instance of the constructor
		var singleton = new constructor();

		// private data repository, non-enumerable
		Object.defineProperty(singleton, '_private', {value:{}, enumerable:false});

		// id of the singleton
		singleton.id = singletonName;

		// Apply Soonable and Bindable mixins to the singleton.
		Mixin.mixinTo(singleton, "Soonable");
		Mixin.mixinTo(singleton, "Bindable");

		// add the base set of defaults for all singletons
		//	NOTE: we don't do this as a prototype 'cause that messes up debugging
		Property.extend(singleton, Singleton.defaults);

		// custom toString semantics
		singleton.toString = function(){return "["+singletonName+"]"};

		// pick up any mixins defined in the properties and apply them FIRST
		if (properties && properties.mixins) {
			Mixin.mixinTo(singleton, properties.mixins);
			delete properties.mixins;
		}

		// add properties passed in AFTER MIXINS
		singleton.extend(properties);

		// set up Class and global pointer to the singleton
		if (Class.debug) console.info("(Class.js):  singleton is accessible as Class."+singletonName);
		Singleton[singletonName] = singleton;

// TODO... ???
		Module.globalize(singletonName, singleton);

		// call the init method if present
		if (typeof singleton.init === "function") singleton.init();

		if (Class.debug) console.groupEnd();

		return singleton;
	};

	// Methods to give to all Singletons
	Singleton.defaults = {
		isASingleton	: true,
		extend  		: Class.extendThis
	}

	Module.globalize("Singleton", Singleton);
	return Singleton;
});	//	end define("oak/lib/core/Singleton")

