/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Function instance extensions
//
Module.define("oak/lib/js/Function", "oak/lib/js/Object", function() { 
	var __slice = Array.prototype.slice;
	Property.patch(Function.prototype, {
		// define function.bind if necessary
		bind : function(scope, arg1, arg2, etc) {
			var boundArgs = Array.prototype.slice.call(arguments, 1), method = this;
			return function bound() {
				var boundScope = scope || this,
					args = boundArgs.concat(__slice.call(arguments, 0))
				;
				return method.apply(boundScope, args);
			}
		}
	});
	
	// make function.name work
	var fn = function fn(){}
	if (!fn.name) {
		Object.defineProperty(Function.prototype, "name", {
			enumerable : false,
			get : function() {
				var toString = Function.prototype.toString.apply(this);
				var match = (toString).match(/^\s*function\s*(.*?)\s*\(/);
				return (match ? match[1] : "");
			}
		});
	}
	
	Property.patch(Function, {
		// Return the list of arguments TO THE CALLING FUNCTION as a proper array.
		// Pass startIndex as the number of arguments to skip in the resulting array.
		//
		//	eg:		function myFunc(arg1, arg2, arg3, etc) {
		//				var realArray = Function.args();
		//				// realArray = [arg1, arg2, arg3, etc]
		//			}
		//
		//	eg:		function myFunc(arg1, arg2, arg3, etc) {
		//				var realArray = Function.args(2);
		//				// realArray = [arg3, etc]
		//			}
		args : function args(startIndex) {
			return Array.prototype.slice.call(arguments.callee.caller.arguments, startIndex||0);
		}
	});
	return Function;
});	// end define("oak/lib/js/Function")
