/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


//
//	"Soon"able interface
//
//	Allows you to invoke a method "soon" on an object,
//	 and have it fire only once with multiple "soon" calls.
//
Module.define("oak/lib/core/Soonable",
"oak/lib/core/Mixin,oak/lib/core/Property",
function(Mixin, Property) {
	var FAILED = "FAILED";
	new Mixin("Soonable", {
		// Call some named method on this object "soon"
		//		"methodName" is the name of the method to call
		//			OR
		//					 a function to call on this object.
		//		"args" is an ARRAY of arguments to pass to the method.
		//		"delay" is the callback delay in SECONDS (default is 10 msec)
		//
		//	Returns a promise which will be resolved() with the value of the method
		//	if we perform the action, or rejected() if another soon WITH DIFFERENT ARGUMENTS
		//	comes in before this soon completes.
		//
		//	Note: you can omit the delay, whether you pass args or not,
		//			in which case the delay is 0, meaning it will execute
		//			as soon as the current script context finishes.
		//		eg:   widget.soon("doSomething", [arg1, arg2])   is fine.
		//
		//	Note: if you call this repeatedly while a "soon timer" of the same name
		//			is still outstanding, it will extend the delay and only
		//			make the call once.  In this case, the args of the last call
		//			within the specified time will win.
		soon : Property.Hidden(function(methodName, delay, args) {
			// reshuffle the arguments if they pass args but not delay
			if (arguments.length == 2) {
				if (typeof delay !== "number") {
					args = delay;
					delay = null;
				}
			}
			if (!args) args = [];

			// default to call back right after the current script context completes.
			if (typeof delay === "number") {
				// convert delay to milliseconds
				delay *= 1000;
			} else {
				delay = 10;
			}

			// set up a promise
			var promise = new $.Deferred();
			// set up the completion function
			var self = this;

			// if we were passed a function explicitly, this is an alias for a non-cancelable timeout
			if (typeof methodName === "function") {
				setTimeout(function() {
					var response = methodName.apply(self, args);
					promise.resolveWith(this, [response]);
				}, delay);
				return promise;
			}

			if (typeof this[methodName] !== "function") {
				return console.error("Error: called widget.soon("+methodName+") with invalid method");
			}

			// make sure we have a unique __soon__ map for this object
			if (!this.__soon__) this.__soon__ = {};

			// If we already have a soon in the queue for this method
			var oldSoon = this.__soon__[methodName];
			if (oldSoon) {
				// if the arguments are the same,
				if (argsMatch(oldSoon.args, args)) {
					// reset the timer with the new delay
					clearTimeout(oldSoon.timer);
					oldSoon.timer = setTimeout(oldSoon.completed, delay);
					// and return the original promise
					return oldSoon.promise;
				} else {
					this.clearSoon(methodName, FAILED);
				}
			}

			function completed() {
				delete self.__soon__[methodName];
				var result = self[methodName].apply(self, args);
				if (result && typeof result.done === "function") {
					result.done(function(value){promise.resolveWith(self, [value])});
				} else {
					promise.resolveWith(self, [result]);
				}
			}
			timer = setTimeout(completed, delay);
			this.__soon__[methodName] = {
				timer 		: timer,
				promise		: promise,
				args		: args,
				completed	: completed
			}

			return promise;
		}),

		// Clear a 'soon' timeout created with this.soon()
		clearSoon : Property.Hidden(function(methodName, failed) {
			if (!this.__soon__) return;
			var soon = this.__soon__[methodName];
			if (soon) {
				delete this.__soon__[methodName];
				clearTimeout(soon.timer);
				if (FAILED) soon.promise.rejectWith(this);
			}
		}),

	});	// end new Mixin("Soonable")

	// Do two sets of arguments match?
	function argsMatch(oldArgs, newArgs) {
		if (oldArgs.length !== newArgs.length) return false;
		for (var i = 0; i < oldArgs.length; i++) {
			if (oldArgs[i] != newArgs[i]) return false;
		}
		return true;
	}

	return Mixin.Soonable;
});	// end new Mixin("Soonable")
