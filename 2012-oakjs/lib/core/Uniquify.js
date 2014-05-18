/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Mixin used to make it easy to work with unique instances of a class.
//
//	By mixing this in to your classes, we'll:
//
//		- automatically set up a class registry, which you can use to register instances, via:
//			  	`YourClass.register(instance, instanceId)`
//
//		  NOTE: if you don't specify an instanceId, we'll attempt to divine one with:
//				`YourClass._getInstanceId(instance)`
//
//		- you can then do the following:
//			- 	`YourClass.get()`						returns map of `{instanceId : instance}`
//			-	`YourClass.get(instanceId)`				returns a single instance by id
//			-	`YourClass.forEach(method, scope)`		iterate over all instances
//			- 	`YourClass.map(method, scope)`			iterate over all instances & return map `{instanceId : returned value}`
//			-	`YourClass.filter(method, scope)`		returns map of instances for which `method` returns a truthy value.
//
//			NOTE: iteration above may not be in the same order as you registered the instances!
//
//		- You can automatically register items as their constructed (after their `init()` call)
//			by setting 	`YourClass._autoRegister = true`
//		  In this case, you MUST ensure that `YourClass._getInstanceId(instance)` returns unique ids.
//
//		- if you have a class-level variable `_registerDirectlyOnClass`,
//		  we will automatically register each item on the Class, so you can access instances as:
//				`YourClass.instanceId`
//		  This is convenient, but use with discretion, as you don't want to conflict with other Class variables.
//
//	NOTE:  Subclasses will automatically get their own REGISTRY!
//			If you want subclasses to share a registry,
//				- make sure `YourClass._autoRegistry = false`
//				- manually register on the superclass in init():
//					new Class("YourClass", "SuperClass", {
//						...
//						init() {
//							... do stuff ...
//							SuperClass.register(this);
//						}
//					})
//
Module.define("oak/lib/core/Uniquify",
"oak/lib/core/Mixin",
function(Mixin) {

	return new Mixin("Uniquify",
	// methods & properties applied to the CLASS!
	{
		// Add an instance to our registry.
		register : function(instance, id) {
			// attempt to derive the id
			// NOTE: numbers (including `0`) are a legal ids!!!
			if (!(["number","string"].contains(typeof id))) {
				if (instance) id = this._getInstanceId(instance);
				if (!(["number","string"].contains(typeof id))) {
					throw this+".register(instance,null): no id specified!";
				}
			}

			if (instance == null) {
				delete this.REGISTRY[id];
			} else {
				// if already registered to instance, just bail
				if (this.REGISTRY[id] === instance) return instance;
				// throw if registered to something else
				if (this.REGISTRY[id] !== undefined) throw this+".register(instance,'"+id+"'): already have an instance with that id!";
				this.REGISTRY[id] = instance;
			}
			// register directly on class
			if (this._registerDirectlyOnClass) {
				// throwing if it's already defined
				if (instance && this[id] !== undefined) {
					throw this+".register(instance,'"+id+"'): attempting to set on class, but "+this.id+"."+id+" is already set!";
				}
				if (instance) 	this[id] = instance;
				else			delete this[id];
			}
			return this.REGISTRY[id];
		},

		// Return an instance or the map of all instances.
		get : function(instanceId) {
			// if no instanceId specified, return a CLONE of the registry
			if (instanceId === undefined) return Property.extend({}, this.REGISTRY);
			// otherwise return the instance with that id
			return this.REGISTRY[instanceId];
		},

		// Iterate for each instance.
		// Default `scope` is the instance itself.
		forEach : function(method, scope) {
			// call map and swallow the results
			this.map(method, scope);
		},

		// Iterate for each instance, returning a map of results.
		// Default `scope` is the instance itself.
		map : function(method, scope) {
			var results = {};
			for (var instanceId in this.REGISTRY) {
				var instance = this.REGISTRY[instanceId];
				results[instanceId] = method.call(scope || instance);
			}
			return results;
		},

		// Return a map of the instances for which `method` returns a truthy value.
		// Default `scope` is the instance itself.
		filter : function(method, scope) {
			var results = {};
			for (var instanceId in this.REGISTRY) {
				var instance = this.REGISTRY[instanceId];
				var result = method.call(scope || instance);
				if (result) results[instanceId] = instance;
			}
			return results;
		}


	},
	// method to apply the mixin to the CLASS, not the instance
	function makeUniquified(target){
//console.debug(target, typeof target);
		// apply to CLASS, not instance
		if (typeof target !== "function") target = target.constructor;
		if (typeof target !== "function") throw "You must apply the Uniquify mixin to a Class.";

		if (Mixin.debug) console.info("(Mixin.js):  Mixing '"+mixinName+"' in to ",target);

		// mix the above methods in, allowing deferring to methods already defined
		Property.mixin(target, Mixin.Uniquify);
		// assign registry directly, so we won't pick up from our super accidentally
		target.REGISTRY = {};
/*
		// if class says we should auto-register,
		//	wrap the prototype.init() method to register automatically
		if (target._autoRegister) {
			var originalInit = target.prototype.init;
console.debug(target, originalInit);
			target.prototype.init = function() {
				var result = originalInit.apply(this, arguments);
				target.register(this);
				return result;
			}
		}
*/
	});	// end new Mixin("Uniquify")
});	// end define("oak/lib/core/Uniquify")
