/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


/*
	Class abstraction and friends.

	Create a new class and set it up to be globally accessible:
		`new Class("MyGreatClass", superClass, instanceDefaults, classDefaults)`
	and then you can create instances via:
		`var myInstance = new MyGreatClass();`

 */

// NOTE: you can turn on debugfing of class creating by doing
//		Class.setDebug(true|false)

Module.define("oak/lib/core/Class",
"oak/lib/js/Object,oak/lib/core/Property-Exotic,oak/lib/core/Mixin,oak/lib/core/Soonable,oak/lib/core/Bindable,oak/lib/js/Array",
function(Object, Property, Mixin, Soonable, Bindable) {

	// If "Class" is already defined at a global level, this won't work.
	if (Module.getGlobal("Class")) throw "(Class.js):  global variable 'Class' already exists!";

	// Create a new class and set it up to be globally accessible.
	//	@constructor:	Name of your class or constructor function.
	//
	//					If a constructor function, it  MUST be named with the name of your class, eg:
	//
	//						function MyGreatClass(){}
	//
	//					NOTE: your constructor will be called to create the class prototype
	//							and passed the Class.PROTOTYPE_FLAG,
	//							so detect that case and skip any customization:
	//
	//						function MyGreatClass(arg1) {
	//							if (arg1 === Class.PROTOTYPE_FLAG) return this;
	//							... do your stuff here ...
	//						}
	//
	//					Your class will be globally accessible as:
	//						- Class.MyGreatClass	and
	//
	//
	//	@superClass		(optional) Super class for your new class.  Class.Thing is the default.
	//	@defaults		(optional) Default properties/methods for all instances of your class.
	//	@classDefaults	(optional) Methods to apply at the class level.
	function Class(constructor, superClass, defaults, classDefaults) {
		if (Class.debug) console.group("new Class(",arguments,")");
		if (!defaults) defaults = {};

	// set up superclass
		// if the superClass passed in is a string, look it up as Class[superClass]
		if (typeof superClass === "string") {
			if (typeof Class[superClass] !== "function") {
				console.warn(arguments);
				throw "(Class.js):  new Class("+className+"):  superClass '"+superClass+"' must be a Class or the name of a Class!  Did you forget to require() it?";
			}
			if (Class.debug) console.info("(Class.js):  deferenced class '"+superClass+"' to "+Class[superClass]);
			superClass = Class[superClass];
		}
		// if the second parameter isn't a function, then they've skipped the superclass
		//	adjust the arguments accordingly
		if (superClass && typeof superClass !== "function") {
			classDefaults = defaults;
			defaults = superClass;
			superClass = null;
		}

		// default to be a subclass of Thing. (NOTE: Class.Thing will be null in our bootstrap case).
		// add superclass property defaults to the prototype, including getters/setters.
		superClass = superClass || Class.Thing

	// set up constructor

		if (!constructor) throw "(Class.js):  new Class("+arguments+"): you must pass a constructor name or method!";
		// if the constructor is just a string, create a constructor function dynamically
		//	 NOTE: for reflection/debugging in Gecko and Webkit, we create the constructor in an eval()
		//			so that instances will show up in the console with the class name.
		if (typeof constructor === "string") {
			var className = constructor;
			eval("constructor = function "+className+"(){\n"
					// ALWAYS set up _private variable, even on prototypes
					+ " Property.getPrivateData(this);\n"
					+ "	if (arguments[0] === Class.PROTOTYPE_FLAG) return this;\n"
					+ "	try {"
					+ "		this.init.apply(this, arguments);\n "
					+ "	} catch (e) {\n"
					+ "		console.error('Exception during .init() when constructing ',this,e);"
					+ "	}\n"
					+"}");
		} else if (typeof constructor === "function") {
console.warn("new Class(",className,"): passing its own constructor, which may not set up `thing._private`");
			// Figure out the className from the constructor definition.
			//	It's a fatal error if the function is not named!
			var className = constructor.name;
			if (!className) throw "(Class.js):  new Class("+constructor+"):  constructor function must be named!";
		}
		if (Class.debug) console.info("(Class.js):  constructor:", constructor, " className: ",className);


		// add class name to the constructor for reflection
		constructor.id = className;

	// set up superclass relationship
		// copy methods on superClass constructor to our constructor
		if (superClass) {
			// if we have a class, start at the beginning and apply the classDefaults for each super to us
			//	this should make us share the same setup as our super
			if (superClass.isAClass && superClass.supers) {
				var i = superClass.supers.length, _super;
				while ((_super = superClass.supers[--i])) {
					Property.extend(constructor, _super.classDefaults);
				};
			} else {
				Object.extendFromObject(constructor, superClass);
			}
		}

		// actually add class methods
		if (classDefaults) {
			Property.extend(constructor, classDefaults);
			constructor.classDefaults = classDefaults;
		}

		// set up supers relationship
		constructor.supers = (superClass && superClass.supers ? [].concat(superClass.supers) : []);
		constructor.supers.prepend(constructor);



		// constructor.protoChain == list of all prototypes, with this class's proto at the top
		constructor.protoChain = [];
		if (superClass) {
			if (superClass.protoChain) {
				constructor.protoChain = constructor.protoChain.concat(superClass.protoChain);
			} else {
				constructor.protoChain.push(superClass.prototype);
			}
		}

	// set up prototype

		// Create prototype and hook it up to the constructor.
		// NOTE: We create the prototype as an instance of the SUPERCLASS
		//			but then set it's 'constructor' property to the constructor function.
		//		 This means that we'll get properties from the superclass.prototype,
		//		    but will think of ourselves as an instance of this class.
		var prototype = (superClass ? new superClass(Class.PROTOTYPE_FLAG) : new constructor(Class.PROTOTYPE_FLAG));
		Object.defineProperty(prototype, "constructor", {enumerable:false, value:constructor});
		constructor.prototype = prototype;
		if (Class.debug) console.info("(Class.js):  prototype:", prototype);

		// Set up an "as<className>" method,
		//	which allows us to directly call a method on any superclass prototype.
		// NOTE: this is also useful to see if you're a descendant of some class,
		//			by checking for `this.as<className>` being defined.
		Object.createAsMethod(className, prototype, defaults);

//console.info("defaults:", defaults);
		// add any defaults passed in to the prototype
		Property.extend(prototype, defaults);
		// and remember them on the constructor for fancy multiple inheritance tricks
		constructor.defaults = defaults;

		// out our prototype at the BEGINNING of the protoChain
		constructor.protoChain.prepend(constructor.prototype);


		// assign pointer to Class object
		Class.register(constructor, className);

		// call class init method if there is one
		if (constructor.initClass) constructor.initClass();

		if (Class.debug) console.groupEnd();

		return constructor;
	}

	Property.extend(Class, {
		// Set to true to debug class creation
		debug : false,

		// Flag passed to constructor functions when creating prototype.
		PROTOTYPE_FLAG : {},

		// register some random constructor as a class
		register : function(constructor, id) {
			if (Class.debug) console.info("(Class.js):  ",constructor," is accessible as Class."+id);
			Class[id] = constructor;
			constructor.isAClass = true;
			return constructor;
		},

		//
		//	utility functions
		//

		// Get a class by name or reference.
		get : function(id) {
			if (!id) return;
			if (id.isAClass) return id;
			var it = Class[id];
			if (!it.isAClass) console.warn("(Class.js): Class.get(",id,"): couldn't find class");
			return it;
		},

		extendThis : function(map, skipProperties) {
			return Property.extend(this, map, skipProperties);
		},

		// Copy properties from the `source` to `target, checking for getters and setters.
		//	Used in Class() constructor to correctly hook up getters/setters from sourcetypes.
		extendFromObject : function(target, source) {
			var getter, setter, value;
			var properties = Object.getOwnPropertyNames(source);
			for (var i = 0, last = properties.length; i < last; i++) {
				var key = properties[i];
				getter = source.__lookupGetter__(key);
				setter = source.__lookupSetter__(key);
				if (getter || setter) {
					Object.defineProperty(target, key, new Property({get:getter, set:setter}));
				} else {
					target[key] = source[key];
				}
			}
		},




		toString : function(){ return "[Class]" }
	});
	Module.globalize("Class", Class);


//
// Class.Thing is our base class, which provides handy methods.
//	It will be used as your superClass in Class.create() if you don't provide one.
//
//	Define it now as a module so we can require "oak/lib/core/Class" and not [also] worry about requiring "oak/lib/core/Thing".
//
	var Thing = new Class(
		// Class name
		"Thing",

		// instance defaults
		{
			// Intialize this instance.  Default is to take a bag of properties to apply to the instance.
			init : Property.Hidden(function(properties) {
				this.extend(properties);
			}),

			// Extend the instance with a new set of properties.
			// NOTE: this will `Object.defineProperty()` any Property objects that we run across.
			extend : Property.Hidden(function(map) {
				if (map) {
					// Handle mixins FIRST
					if (map.mixins) this.mixins = map.mixins;
					// Assign properties ignoring mixins processed before
					Property.extend(this, map, ["mixins"]);
				}
				return this;
			}),

			// Add mixins directly to an instance by assigning to the "mixins" property.
			mixins : Property.Setter(function(mixins) {
				Mixin.mixinTo(this, mixins);
			}, {enumerable:false}),

			// Return an identifying string for this instance (for reflection).
			toString : Property.Hidden(function() {
				if (!this.constructor) return "[object]";
				var id = (this === this.constructor.prototype ? "prototype" : this.constructor._getInstanceId(this));
				if (id) return "["+this.constructor.id+" "+id+"]";
				return "[anonymous "+this.constructor.id+"]";
			})

		},

		// class methods
		{
			// true if we're a class
			isAClass : Property.Constant(true),

			// Extend the instance with a new set of properties.
			// NOTE: this will `Object.defineProperty()` any Property objects that we run across.
			extend : Property.Hidden(function(map) {
				if (map) {
					// Handle mixins FIRST
					if (map.mixins) this.mixins = map.mixins;
					// Assign properties ignoring mixins processed before
					Property.extend(this, map, ["mixins"]);
				}
				return this;
			}),

			// Add mixins directly to an class by assigning to the "mixins" property.
			mixins : new Property.Setter(function(mixins) {
				Mixin.mixinTo(this, mixins);
			}, {enumerable:false}),

			// Return an identifying string for an instance, for reflection.  Used in instance.toString()
			//	Override if you have a different property which uniquely identifies your instances.
			_getInstanceId : function(instance) {
				return instance.id;
			},

			// Return an identifying string for this class (for reflection).
			toString : function() {
				return "[Class "+this.id+"]";
			}
		}
	);

	// Add "Soonable" and "Binable" mixins manually to all Things.
	Thing.prototype.mixins = "Soonable,Bindable";


	// Define "Thing" as a module we can load, just in case someone tries.
	new Module("oak/lib/core/Thing", "oak/lib/core/Class", null, Thing);



	return Class;
});// end define("oak/lib/core/Class")

