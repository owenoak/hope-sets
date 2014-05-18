/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


//
//	"Bind"able interface
//
//	Allows you bind a method on this object to the object itself.
//
//	Remembers old bindings, so a second call to this.bind("method") will
//	return the same value as the first.
//
//	NOTE: you can't bind with arguments, use function.bind() directly for that.
//
Module.define("oak/lib/core/Bindable",
"oak/lib/core/Mixin,oak/lib/core/Property-Exotic",
function(Mixin, Property) {
	return new Mixin("Bindable", {

		_boundMethods : Property.InstanceObject("boundMethods", {enumerable:false}),

		// Bind a named function to us, returning the same bound function if called twice.
		bind : Property.Hidden(function(methodName) {
			var boundMethods = this._boundMethods;
			if (boundMethods[methodName] == null) {
				var method = this[methodName];
				if (typeof method !== "function") {
					console.warn(this,".bind(",methodName,"): no such method found");
					method = function boundFunctionNotFound(){}
				}
				boundMethods[methodName] = method.bind(this);
			}
			return boundMethods[methodName]
		}),



		// Bind a method to us to be called 'soon'.  Returns the same function if called twice.
		// NOTE: depends on 'Soonable' being mixed into the target object.
		bindSoon : Property.Hidden(function(methodName, delay) {
			var boundMethods = this._boundMethods;
			var soonMethodName = methodName +"_soon";
			if (boundMethods[soonMethodName] == null) {
				var method = this[methodName];
				if (typeof method !== "function") {
					console.warn(this,".bindSoon(",methodName,"): no such method found");
					method = function boundFunctionNotFound(){}
				} else {
				 	method = function(){ this.soon(methodName, delay) }.bind(this);
				}
				boundMethods[soonMethodName] = method;
			}
			return boundMethods[soonMethodName]
		}),


	});
});