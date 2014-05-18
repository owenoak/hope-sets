/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Define "exotic" custom Property types that we can use when creating Widgets and other interesting classes.
//

Module.define("oak/lib/core/Property-Exotic",
"oak/lib/core/Property,oak/lib/js/Object",
function(Property, Object) {


	// `preference` property -- tracks a preference set on this object.
	//	Note: we assume the recipient has a "preference" method!
	//	`options` are:
	//		- defaultValue : (defualt is undefined)
	//		- onChange(newObject, oldObject) : method, function to call when the `preference` changes.
	Property.Preference = function Property_Preference(property, options) {
		if (!options) options = {};
		if (!options.type) options.type = "string";
		var propertyOptions = {
			get : function() {
				var value = this.preference(property);
				if (value == null) value = options.defaultValue;
				return value;
			},
			set : function(newValue){
				var oldValue = this[property];
				this.preference(property, newValue);
				// call options.onChange() method if defined
				if (options.onChange) options.onChange.apply(this, [newValue, oldValue]);
			}
		};
		if (options.hasOwnProperty("enumerable")) propertyOptions.enumerable = options.enumerable;
		return new Property(propertyOptions);
	}


	// `watchable` property which represents an object we will "watch" for certain events.
	//	Note: we assume the events to watch are the same for all watched objects!
	//	`options` are:
	//		- getWatchEvents() : Method called on `this` which returns event map to watch for.
	//							 NOTE: this will only be called if the events haven't already been gotten for this object.
	//		- onChange(newObject, oldObject) : method, function to call when the `watchable` has changed.
	Property.WatchedObject = function Property_WatchedObject(property, options) {
		if (!options) throw "WatchedObject("+property+"): must be called with options";
		if (!options.getWatchEvents) throw "WatchedObject("+property+"): must be called with options.getWatchEvents()";

		var internalProperty = "__"+property+"__";
		var eventProperty = "__"+property+"-events__";
		var propertyOptions = {
			get : function() {
				return this[internalProperty]
			},
			set : function(newObject){
				// get the events to watch from the `options.getWatchEvents()` method, and save the results.
				if (!this.hasOwnProperty(eventProperty)) this[eventProperty] = options.getWatchEvents.apply(this);
				var events = this[eventProperty];
				// turn off events for oldObject, and turn them on for new object
				var oldObject = this[internalProperty];
				if (oldObject) $(oldObject).off(events);
				if (newObject) $(newObject).on(events);
				this[internalProperty] = newObject;
				// call options.onChange() method if defined
				if (options.onChange) options.onChange.apply(this, [newObject, oldObject]);
			}
		};
		if (options.hasOwnProperty("enumerable")) propertyOptions.enumerable = options.enumerable;
		return new Property(propertyOptions);
	}


	// Alias a shorthand property on an object as syntactic sugar for some sub-property.
	Property.Alias = function Property_Alias(newProperty, originalProperty, options) {
		if (!options) options = {};
		options.get = function()		{return this[originalProperty]};
		options.set = function(value)	{this[originalProperty] = value}
		return new Property(options);
	}


	// Alias a shorthand property on an object as syntactic sugar for some sub-property on some other object we point to.
	Property.DelegatedAlias = function Property_DelegatedAlias(newProperty, originalObjectProperty, originalProperty, options) {
		if (!originalProperty) originalProperty = newProperty;
		var propertyOptions = {};
		propertyOptions.get = function() {
			var it = this[originalObjectProperty];
			if (it == null) return undefined;
			return it[originalProperty];
		};
		// give us a set method if options.writeable is not false.
		if (!options || options.writable != false) {
			propertyOptions.set = function(value) {
				var it = this[originalObjectProperty];
				if (it != null) it[originalProperty] = value;
			}
		}
		return new Property(propertyOptions);
	}


	//	An InstanceObject is a `property` which returns some type of object specific to this instance.
	//
	//	If the instance doesn't have its own copy, we'll create an instance of `constructor` automatically.
	//	 The default constructor is Object.  Use `InstanceArray` if you want an array instead, or pass any other object type.
	//
	//	By default, the property is enumerable.  Pass {enumerable:false} in the objects to hide the property.
	//
	Property.InstanceObject = function Property_InstanceObject(property, options) {
		if (!options) options = {};
		if (!options.constructor) options.constructor = Object;

		var internalProperty = "__"+property+"__";
		var propertyOptions = {
			get : function() {
				if (!this.hasOwnProperty(internalProperty)) this[internalProperty] = new options.constructor();
				return this[internalProperty];
			},

			// NOTE: we don't do any type checking on set...
			set : function(value) {
				this[internalProperty] = value;
			}
		}
		if (options.hasOwnProperty("enumerable")) propertyOptions.enumerable = options.enumerable;
		return new Property(propertyOptions);
	}


	//	An `InstanceArray` is a `property` which returns an array guaranteed to be unique for this instance.
	Property.InstanceArray = function Property_InstanceArray(property, options) {
		if (!options) options = {};
		if (!options.constructor) options.constructor = Array;
		return InstanceObject(property, options);
	}

	//
	//	A `ProtoList` is a property which returns an instance-specific array
	//   which includes values from all similarly-named arrays in its prototype chain or mixin chain.
	//
	//	 Items from protypes/mixins will be EARLIER in the resulting list than items from this object.
	//
	//	Pass `defaults` to the constructor to add default values to ALL instances.
	//
	//	NOTE: if you don't pass `defaults` and you (and supers/mixins) have never assigned anything
	//		  to the named property, it will return `undefined`.
	//
	//	NOTE: the object you get back from this (if defined) is stable -- eg: calling the function again
	//		  will return the same one.  Mutating this may or not be a good idea...
	//
	//	See `oak/lib/ui/Widget:events`
	//
	Property.ProtoList = function Property_ProtoList(property, defaults) {
		var internalProperty = "__"+property+"__";
		return new Property({
			get : function() {
				if (this.hasOwnProperty(internalProperty)) return this[internalProperty];
				var list = this[internalProperty] || defaults;
				if (list) return (this[internalProperty] = [].concat(list));
				return undefined;
			},

			set : function(list) {
				if (list == null || list.length == 0) return;
				var instanceList = this[property];
				if (!instanceList) instanceList = (this[internalProperty] = []);
				for (var i = 0; i < list.length; i++) {
					var it = list[i];
					if (it != null) instanceList[instanceList.length] = it;
				}
			}
		});
	}


	//
	//	A `ProtoMap` is a property which returns an instance-specific map
	//	 which includes values from all similarly-named maps in its prototype and mixin chain.
	//
	//	Properties in the returns map from protypes/mixins will be OVERRIDDEN by properties from farther up the chain,
	//	 thus properties on the object's map itself will always win.
	//
	//	If there has NEVER been anything set for that property, it will return 'undefined'.
	//
	//	NOTE:   Whenever you access the property, you'll get an object back which is specific to your instance.
	//			This should be stable, eg: modifying it will affect that instance only.
	//
	//	If you want to remove something from a map lower down the chain, set the property to `undefined`, eg:
	//			new Class("MyClass", {
	//									...
	//									myProp : new Property.ProtoMap("myProp", {a:1, b:2})
	//									...
	//								  });
	//
	//			var instance1 = new MyClass({
	//									...
	//									myProp : {b:1, c:2}
	//									...
	//								  });
	//			instance1.myProp => {a:1, b:1, c:2};
	//
	//			var instance2 = new MyClass({
	//									...
	//									myProp : {a:undefined, b:1, c:2}
	//									...
	//								  });
	//			instance2.myProp => {b:1, c:2};
	//
	//	See `oak/lib/ui/Widget:parts` for an example.
	//
	Property.ProtoMap = function Property_ProtoMap(property, defaults) {
		var internalProperty = "__"+property+"__";
		return new Property({
			get : function() {
				if (this.hasOwnProperty(internalProperty)) return this[internalProperty];
				var map = this[internalProperty] || defaults;
				if (map) {
					var copy = {};
					for (key in map) {
						copy[key] = map[key];
					}
					return (this[internalProperty] = copy);
				}
				return undefined;
			},

			set : function(map) {
				if (map == null) return;
				// NOTE: this will return a copy or undefined
				var internalMap = this[property];
				if (!internalMap) internalMap = this[internalProperty] = {};
				for (key in map) {
					internalMap[key] = map[key];
				}
			}
		});
	}

	//
	// An `Expression` is a property which can be set to:
	//	- a function which will be dynamically evaluated to return the value, or
	//	- a string which will be `eval`d to return the value.
	//
// TODO: install the expression directly on the getter!!!  DUH!!!
	Property.Expression = function Property_Expression(options) {
		if (!options) options = {};

		// Set up the current value from options (may be `undefined`).
		var defaultValue = options.value;

		options.applyTo = function(target, key) {
			var property = this;
			if (!property.get) {
				// If callOnScope is true, we call the method on `this.scope` instead of `this`.
				// For example, actions use this to reference a widget rather than the action itself.
				var callOnScope = !!options.callOnScope;
				// add `wrap` to your property options to wrap access in a try...catch
				if (options.wrap) {
					property.get = function(){
						var target = (callOnScope ? this.scope : this);
						try {
							return this._private[key].call(target)
						} catch (e) {
							console.error(this+'.'+key+' returned an error on access:',e);
						}
					};
				}
				// don't wrap
				else {
					property.get = function(){
						var target = (callOnScope ? this.scope : this);
						return this._private[key].call(target);
					};
				}
			}
			property.set = function(value) {
				var method = value;
				// if they gave us a string, convert it to a function
				if (typeof method !== "function") {
					// pass through `options.filter` if defined, eg: see `BooleanExpression`
					if (options.filter) {
						method = options.filter(method);
					}

					// if it's a string, create a new function to evaluate the expression
					if (typeof method === "string") {
						if (method.contains("return")) 	method = new Function(method);
						else							method = new Function("return ("+method+")");
					}
				}
//console.warn(""+method);
				// if they gave us a function,
				if (typeof method === "function") {
					// simply assign the function for our getter to call.
					this._private[key] = method;
				} else {
					this._private[key] = function(){return value};
//					console.error("Property.Expression(",this.id,",",key,"): don't know what to do with ",value);
				}
			}
			// actually define on the object
			property.defineFor(target, key);

			if (typeof defaultValue === "function") {
				target._private[key] = defaultValue;
			}
			// create a function to return the default
			else {
				target._private[key] = function(){return defaultValue};
			}

		}

		return new Property(options);
	}


	// Given an expression, return a boolean if it's one of "true", "yes", "1", "false", "no", "0"
	// If none of those things, return undefined;
	Property.getBooleanStringValue = function (expression) {
		if (typeof expression === "boolean") return expression;
		if (typeof expression !== "string") return undefined;
		expression = expression.toLowerCase();
		if (["true","yes","1"].contains(expression)) return true;
		if (["false","no","0"].contains(expression)) return false;
		return undefined;
	}

	Property.BooleanExpression = function Property_BooleanExpression(options) {
		if (!options) options = {};
		// default to true if no default set
		if (!("value" in options)) options.value = true;
		// transform any expression passed in into a boolean
		options.filter = function(expression){
			// if they passed a boolean string or a boolean, return that
			var bool = Property.getBooleanStringValue(expression);
			if (bool !== undefined) {
				if (bool) return 	function(){return true};
				else		return function(){return false};
			}
			// !! the expression to convert to a boolean
			if (expression.contains("return")) 	return new Function(expression);
			else								return new Function("return !!("+expression+")");
		};

		// create as a normal Expression
		return Property.Expression(options);
	}

/*

	//
	//	A `BooleanExpression` is a bit of javascript which will be transformed into a function
	//	which will be evaluated on the scope of our object.
	//	The expression should return a boolean.
	//
	//	Note that you can also reference global variables as well.
	//
// TODO: propety.applyTo()
	Property.BooleanExpression = function Property_BooleanExpression(property, defaultValueIfUndefined) {
		return new Property({
			get : function() {
				var value = this._private[property];
				if (this._private[property]) return this._private[property].call(this);
				return defaultValueIfUndefined;
			},

			set : function(expression) {
				// convert to boolean if they passed a simple boolean string
				var bool = Property.getBooleanStringValue(expression);
				if (typeof bool === "boolean") expression = bool;

				var method;
				// if null, false or empty string, clear the property.
				if (!expression && expresion !== 0) {
					method = undefined;
				}
				// simple boolean return
				else if (typeof expression === "boolean"){
					method = function(){ return expression };
				}
				else if (typeof expression === "string") {
					method = new Function([
						"var __state;",
						"try {",
						"	with(this) {",
						"		return !!("+expression+");",
						"	}",
						"} catch (e) {",
						"	console.group(this+'."+property+" dynamic evaluation returned an error:');",
						"	console.error(e);",
						"	console.groupEnd();",
						"}"].join("\n"));
//					console.info(method+"");
				} else {
					throw "Defining "+this+"."+property+": must pass boolean or string to BooleanExpression property";
				}
				this._private[property] = method;
			}

		});
	}
*/


	return Property;
});	// end define("oak/lib/core/Property-Exotic")
