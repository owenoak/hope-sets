/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
// Property type, for use with Property.extend() and Property.patch()
//	as a signal to do a defineProperty() rather than simply assign a simple value.
//
// TODOC
//
Module.define("oak/lib/core/Property",
function() {
	// Shim in ECMAScript Object.defineProperty() so we can use it below.
	//	Note: if this shim is used, we will NOT be able to make properties non-enumerable or non-configurable!
	if (!Object.defineProperty) {
		// if __defineGetter__ is not available on an empty object, this won't work!
		if (!{}.__defineGetter__) throw "Browser.js: can't define Object.defineProperty because __defineGetter__ method not found";

		// warn that while we can use defineProperty, it won't make things non-enumerable
		console.warn("(Property.js): Object.defineProperty is patched, but cannot make non-enumerable properties.\n"
					+"It is virtually certain that your app will not work!!!");

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

	// legal attributes for properties as per:
	//		https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
	var LEGAL_ATTRIBUTES = ["get", "set", "value", "enumerable", "writeable", "configurable"];



	//
	// Property variant -- intialize with a {value} or getter+setter { get:function(){}, set:function(){} }
	//
	//	To create when you're initializing an object, do:
	//
	//		Property.extend( something, {  ...,  myProperty : Property({ value:10 }), ... });
	//		Property.extend( something, {  ...,  myProperty : Property({ get:function(){}, set:function(){} }), ... });
	//
	function Property(attributes) {
		// handle call without new
		if (this == window || this == Property) return new Property(attributes);

		if (attributes) {
			// make non-legal attributes non-enumerable
			for (key in attributes) {
				var value = attributes[key];
				if (LEGAL_ATTRIBUTES.indexOf(key) > -1) {
					this[key] = value;
				} else {
					Object.defineProperty(this, key, {enumerable:false, value:value});
				}
			}
		}
	}

	Property.prototype = new Property({
		enumerable 		: true,
		configurable 	: true,

		// Apply this property to some `target` as property `key`.
		// Default does `this.define()`, which ignores illegal values.
		applyTo : function(target, key) {
			this.defineFor(target, key);
		},

		// Actually define the property for the target.
		// Use this rather than `Object.defineProperty()` so we only define legal values.
		defineFor : function(target, key) {
			var legalKeys = {
				enumerable 		: this.enumerable,
				configurable	: this.configurable
			};

// TODO:  [getWrappers], [setWrappers] ?
// TODO:  automatically add onChange()
// TODO:  automatically set `value` for getter/setters
// TODO:  automatically add `onError()`, log, etc

			if (this.get || this.set) {
				legalKeys.get = this.get;
				legalKeys.set = this.set;
			} else {
				legalKeys.value 	= this.value;
				legalKeys.writable 	= this.writable;
			}
			Object.defineProperty(target, key, legalKeys);
		}
	})

	// Make this globally available
	Module.globalize("Property", Property);



	// Add a non-enumerable 'toString' method to Property.prototype for debugging.
	Object.defineProperty(Property.prototype, "toString", {
		enumerable:false,
		value : function() {
			var name = (this.name ? this.name.replace(/_/,".") : "Property");
			return "["+name+"]";
		}
	});


//
//	Use `Property.extend()` and `Property.mixin()` and `Property.patch()` to apply properties to a target object.
//	If the value to be applied is an instance of Property, we'll set up the property
//	using Object.defineProperty() for you automatically.
//

	// "extend" some other object by adding properties to it.
	//	- If a property value is an instance of Property, we'll do an Object.defineProperty() on it.
	//	- Otherwise we'll do a simple assigment.
	//  - Pass a list of `skipKeys` to ignore properties with those keys.
	Property.extend = function extend(target, properties, skipKeys) {
		if (!target || !properties) return target;

		for (var key in properties) {
			if (skipKeys && skipKeys.indexOf(key) > -1) continue;

			var value = properties[key];
			if (value instanceof Property) {
				value.applyTo(target, key);
			}
			else {
				target[key] = value;
			}
		}
		return target;
	};


	// "mix in" a map of properties into a <target> object:
	//	- If a property value is an instance of Property, we'll apply that property to the object.
	//	- Otherwise if the target previously had property "foo" defined, the mixin value is ignored.
	//	- Otherwise does a simple assignment of the mixin value.
	//  - If you pass a list of `skipKeys`, we'll ignore those properties.
	Property.mixin = function(target, properties, skipKeys) {
		if (!target || !properties) return target;
		for (var key in properties) {
			if (skipKeys && skipKeys.indexOf(key) > -1) continue;

			var value = properties[key];
			if (value instanceof Property) {
				value.applyTo(target, key);
			} else if (key in target) {
				continue;

			} else {
				target[key] = value;
			}
		}
		return target;
	},




	// "patch" a target object by adding NON-ENUMERABLE properties/methods to it,
	//	 skipping properties which are already defined on the object.
	//
	//	Note: if you pass @force as true, we will ALAWAYS define the property
	//
	//	If one of the attributes is a Property, we'll do a defineProperty() on that
	//	 and will ALWAYS define it, even if the object already has that property defined.
	Property.patch = function patch(target, attributes, force) {
		if (target && attributes) {
			for (var key in attributes) {
				var value = attributes[key];
				if (value instanceof Property) {
//console.warn("patch", target, key, value);
					Object.defineProperty(target, key, value);

				} else if (key in target && force != true) {
					continue;

				} else {
					value = new Property.Hidden(value);
					Object.defineProperty(target, key, value);
				}
			}
		}
		return target;
	};


	// "merge" the `override` object into the `target` object by copying all enumerable nested properties into it.
	// For any objects in `source`, we'll make a copy in `target`.
	// NOTE: assumes we're dealing with simple objects only.
	// TODO: arrays?
	Property.merge = function(target, override) {
		if (!target) target = {};
		if (!override) return target;

		for (var key in override) {
			var value = override[key];
			if (value == null) 							delete target[key];
			else if (value.constructor === Object) 		target[key] = Property.merge(target[key], value);
			else										target[key] = value;
		}
		return target;
	}


	// Given an object, make a new `clone` of that object that points to the original as its prototype.
	// Thus the clone will have access to all of the properties of the original object.
	Property.clone = function(object) {
		if (!object) return {};
		function clone(){}
		clone.prototype = object;
		return new clone();
	}


	// Return the non-enumerable `_private` property for some object.
	//	- If object already has it's own `_private` property, simply returns it.
	// 	- If a prototype has one, we'll clone the `prototype._private` so we get their prototype properties automatically.
	//  - Otherwise creates a new, empty `_private` object directly on us.
	Property.getPrivateData = function(object) {
		// if we don't already have our own _private proeprty:
		if (!object.hasOwnProperty("_private")) {
			var _private;
			// if one of our prototypes has such a property, make a clone
			if ("_private" in object) 	_private = Property.clone(object._private);
			// otherwise create a simple object
			else						_private = {};
			// define in non-enumerable style!
			Object.defineProperty(object, "_private", {value:_private, enumerable:false, writeable:false, configurable:false});
		}
		return object._private;
	}


	Property.walk = function(scope, tokens) {

	}


//
//	Convenience functions for various types of properties you may want to use.
//


	//
	// Property.Message -- dynamically return a value from the message dictionary.
	// Non-enumerable by default.
	//
	//	eg:		{ 	someMessage : Property.Message("foo.bar.baz")	}
	//
	Property.Message = function Property_Message(key, options) {
		if (!options) options = {};
		function expandKey() {
			if (!window.Messages) return "";
			return Messages.get(key, options.scope);
		}
		return Property.Getter(expandKey, options);
	}


	//
	// Property.Getter variant -- just pass a function to the constructor
	//
	//	To create when you're initializing an object, do:
	//
	//		Property.extend( something, {  ...,  myProperty : Property.Getter(function(){...return your value... }), ... });
	//
	Property.Getter = function Property_Getter(method, options) {
		if (!options) options = {};
		options.get = method;
		return new Property(options);
	}


	////////////////
	//
	// Setter variant -- just pass a function to the constructor.
	// NOTE: setters, by default, are non-enumerable.
	//
	//	To create when you're initializing an object, do:
	//
	//		Property.extend( something, {  ...,  myProperty : Setter(function(value){...set your value...}), ... });
	//
	////////////////
	Property.Setter = function Property_Setter(method, extraOptions) {
		var options = { set: method };
		if (extraOptions) for (key in extraOptions) options[key] = extraOptions[key];
		return new Property(options);
	}


	////////////////
	//
	// 	"Hidden" property setter.
	//	This property won't appear in the list of `keys()` of the instance.
	//
	//	NOTE: semantically better to use one of the following instead:
	//			- Property.Private
	//			- Property.Constant
	//
	////////////////
	Property.Hidden = function Property_Hidden(value) {
		return new Property({value:value, enumerable:false, configurable:true, writable:true});
	}


	////////////////
	//
	// 	A "private" property.
	//
	//	Note: "privacy" is not enforced -- this is basically just a flag to callers
	//	that they shouldn't mess with this thing.
	//
	//	However, we'll make the property non-enumerable so it's "hidden".
	//
	////////////////
	Property.Private = function Property_Private(value) {
		return new Property({value:value, enumerable:false, configurable:true, writable:true});
	}


	////////////////
	//
	// 	A "constant" (read-only) property.
	//	Constants are automatically made non-enumerable.
	//	Constant names are generally specified as UPPER_CASE, but not necessarily.
	//
	//	NOTE: Once you've set a constant, it cannot be changed by assignment!
	//		  If you attempt to set it to a new value, the new value will be ignored.
	//
	//		  You can, however, override the constant in a subclass,
	//		  or do an explicit `Object.defineProperty()` to reassign it.
	//
	////////////////
	Property.Constant = function Property_Constant(value) {
		return new Property({value:value, enumerable:false, configurable:true, writable:false});
	}



	////////////////
	//
	// 	A value for which we want to run an `onChange` handler (scoped to this object) as:
	//		`onChange.apply(this, [newValue, oldValue])`
	//	whenever the value is set.
	//
	//	NOTE: this will always be called, even if `newValue === oldValue`!!
	//
	//	You can pass a `options.value`, which will set this value when the property is applied.
	//		- By default we WILL NOT run the `onChange()` handler for this value.
	//		- pass "APPLY" to `options.onSetup` to call the onChange during the setup of the property.
	//		- pass "DEFER" to `options.onSetup` to fire the onChange after a short delay
	//			(which can give your object a chance to let things settle before the onChange handler runs).
	//
	//	By default, we'll just throw any exceptions raised during the onChange handler.
	//		- to ignore all errors completely, 		 	  pass `options.onError = "IGNORE"`
	//		- to log a warning instead of raising errors, pass `options.onError = "WARN"`
	//	Don't do this unless you're sure you want to ignore the exceptions!
	//
	////////////////
	Property.onChange = function Property_onChange(onChangeHandler, options) {
		if (!options) options = {};

		// extract default value from options
		var defaultValue;
		if ("value" in options) {
			defaultValue = options.value;
			// can't have get+set+value in defineProperty() !!!
			delete options.value;
		}

		// applyTo will be called when we're actually applying the value to the object
		options.applyTo = function(target, key) {
			// define the getter and setter when applying the property
			this.get = function(){ return (this._private ? this._private[key] : undefined); };

			// wrap the onChange handler if `options.onError` is set.
			if (options.onError === "IGNORE") {
				// swallow the error completely
				options.onChange = function(oldValue, newValue) {
					try {
						return this.apply(onChangeHandler, arguments);
					} catch (e) {};
				}
			} else if (options.onError === "WARN") {
				// warn about the error but don't raise it
				options.onChange = function(oldValue, newValue) {
					try {
						return this.apply(onChangeHandler, arguments);
					} catch (e) {
						console.warn(this,"."+key+" = ",newValue,":  Error calling onChange().  Error:", e);
					};
				}
			} else {
				// no default error handling
				options.onChange = onChangeHandler;
			}

			this.set = function(newValue) {
				var _private = Property.getPrivateData(this);
				var oldValue = _private[key];
				_private[key] = newValue;
				options.onChange.apply(this, [newValue, oldValue]);
			}

			// actually set up the property
			Object.defineProperty(target, key, this);

			// apply the defaultValue
			if (defaultValue) {
				var onSetup = options.onSetup || "IGNORE";
				// apply to the internal value only, ignoring the onChange
				if (onSetup === "IGNORE") {
					var _private = Property.getPrivateData(target);
					_private[key] = defaultValue;
				}
				// apply through assignment, which will call the onChange
				else if (onSetup === "APPLY") {
					target[key] = defaultValue;
				}
				// apply on a short delay
				else if (onSetup === "DEFER") {
					setTimeout(function(){ target[key] = defaultValue; }, 0);
				}
			}
		}

		// construct the property
		return new Property(options);
	}


/*
	////////////////
	//
	// 	A "bound" method.
	//  Accessing the method will ALWAYS return the method bound to this object.
	//  Useful for event handlers, etc.
	//
	////////////////
//
// TODO: NOT TESTED!!!!  DON'T USE THIS YET!
//
	Property.Bind = function Property_Bind(method, options) {
		if (!options) options = {};
		options.applyTo = function(target, key) {
			this.get = function() {
				var method = Property.getPrivateData(this)[key];
				if (method) return method.bind(this);
			};
			this.set = function(method) {
				Property.getPrivateData(this)[key] = method;
			}
			Object.defineProperty(target, key, this);

			// set the initial value
			target[key] = Method;
		}
		return new Property(options);
	}
*/



	return Property;
});
