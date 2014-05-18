
//
// Simple APICall object wrapper. Sets up default data properties.
//
// NOTE: this is not actually an instance of Class.
// TODO: why not???
//
Module.define("oak/lib/api/APICall",
"oak/lib/core/Class,oak/lib/core/Property",
function(Class, Property) {
	var APICall = Class.APICall = function APICall(properties) {
		Property.extend(this, properties);

		// handle the prototype case
		if (!properties.url) return;

		// expand the operation URL with parameters passed in
		this.params = this.parameters || this.params || { };

		// add global User object if defined
		//	NOTE: we do NOT want to introduct a Module dependency on Facebook here
		//			so don't include in the Module definition.
		if (window.User && !this.params.User) {
			this.params.User = window.User;
		}

		// add global Facebook object if defined
		//	NOTE: we do NOT want to introduct a Module dependency on Facebook here
		//			so don't include in the Module definition.
		if (window.Facebook && !this.params.Facebook) {
			this.params.Facebook = window.Facebook;
		}

		// expand url with parameters + Module url prefixes
		this.url = Module.expandUrl(this.url.expand(this.params));

		// request id, used mostly for debugging
		this.id = this.id || this.url;

		this.synchronous = !!this.synchronous;
		this.type 		 = this.type || this.method || "GET";
		this.dataType 	 = this.dataType || "html";
	}
	APICall.prototype = new APICall({
		toString : function(){return "[APICall "+this.id+"]"}
	});

	return Class.APICall;
});	// end define("oak/lib/api/APICall")
