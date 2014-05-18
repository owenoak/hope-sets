/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
// Simple APIError wrapper, for debugging
//
// NOTE: this is not actually an instance of Class.
// TODO: why not???
//
Module.define("oak/lib/api/APIError",
"oak/lib/core/Class,oak/lib/core/Property",
function(Class, Property) {

	var APIError = Class.APIError = function APIError(errorElement) {
		if (arguments.length === 0) return this;
		Property.extend(this, API.nestedXMLToObject($(errorElement)));
	}
	APIError.prototype = new APIError();
	Property.extend(APIError.prototype, {
		toString : function(){return "[APIError]"}
	});

	return Class.APIError;

});	// end define("oak/lib/api/APIError")
