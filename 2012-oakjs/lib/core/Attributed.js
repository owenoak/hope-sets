/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


//
//	Object with an ordered list of "attributes".
//	Designed to work in concert with the `Property-Attribute` property types.
//
//	Define a non-enumerable "attributes" object in your `init()` with `initAttributes()`
//	Use `setAttribute()` to manipulate the attributes.
//	If you have a `$root` object, we'll keep that in sync with the attributes as you manipulate them.
//	Use `getAttributeString()` to return attributes in order.
//
//	Allows you to invoke a method "soon" on an object,
//	 and have it fire only once with multiple "soon" calls.
//
Module.define("oak/lib/core/Attributed",
"oak/lib/core/Mixin,oak/lib/core/OrderedMap,oak/lib/core/Property-Attribute",
function(Mixin, OrderedMap, Property) {
	new Mixin("Attributed", {

		initAttributes : function() {
			// set up our attributes as a non-enumerable property
			Object.defineProperty(this, "attributes", {
				value		 : new OrderedMap(),
				enumerable 	 : false,
				configurable : false,
				writable	 : false
			});
		},

		// Set an attribute on our attributes object and on our $root element if defined.
		setAttribute : function(key, value) {
			if (value == null) {
				this.attributes.removeProperty(key);
				if (this.$root) this.$root.removeAttr(key);
			} else {
				this.attributes.addProperty(key, value);
				if (this.$root) this.$root.attr(key, value);
			}
		},

		// Add attributes from a jQuery vector, an OrderedMap or a POJO.
		// NOTE: this does not set our $root...
		setAttributes : function(other) {
			if (!other) return;
			// if passed a jQuery vector, convert to ordered attributes
			if (other.jquery) other = other.orderedAttrs();
			var keys = (other instanceof OrderedMap ? other.KEYS : Object.keys(other));
			keys.forEach(function(key) {
				this.setAttribute(key, other[key]);
			}, this);
		},

		// Return our attributes as an HTML-compatible string, in order.
		getAttributeString : function(skipUnknown) {
			return String.htmlAttributesToString(this.attributes);
		},

		// Remove an attribute.
		removeAttribute : function(key) {
			this.setAttribute(key, null);
		},

		// Clear all of our attributes
		clearAttributes : function() {
			this.attributes.forEach(function(key) { this.removeAttribute(key);}, this);
		}

	});	// end new Mixin("Attributed")

	return Mixin.Attributed;
});	// end new Mixin("Attributed")
