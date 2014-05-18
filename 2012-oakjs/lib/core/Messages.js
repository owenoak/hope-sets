/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Super-simple "message dictionary" singleton object.
//	Add all user-facing messages in the app to this file with one or more recognizable message 'keys'.
//	Please keep the keys in alphabetical order.
//
//	It's a good idea to break things up by page or top-level widget.
//	Your app will override and/or augment this generic message set.
//
//	Just reference strings directly to use them:
//
//		var myThing = new SomeClass({
//			...
//			loadingMessage : Messages.foo.bar.loadingMessage
//		});
//
//	You can also substitute in String.expand() with "[[[messagename]]]" (omit the "Messages" bit here), eg:
//			"This will be [[[foo.bar.baz]]] substituted automatically."
//
//	NOTE: you should load this at the very beginning of your package file so recipients can pick it up.
//

Module.define("oak/lib/core/Messages",
	"oak/lib/core/Property",
	function(Property)
{

	// Create a constructor even though we're a singleton for debugging.
	var constructor = function Messages() {}
	constructor.prototype = new constructor();

	Property.extend(constructor.prototype, {
		// `Messages.get(key, scope)`
		// Return the message under the specified `key`.
		// If you pass `scope`, we'll `expand()` the message found with that `scope`.
		get : Property({
			value : function(key, scope) {
				// Split into a list of keys and walk down the Messages object.
				var keys = key.split("."),
					nextKey,
					value = this;
				while ((nextKey = keys.shift())) {
					value = value[nextKey];
					if (value == null) return "";
				}
//console.warn(value, scope);

				// if we got a function, call it with the scope passed in
				if (typeof value === "function") {
					try {
						value = ""+value.apply(scope);
					} catch (e) {
						console.error("Message.get(",key,",",scope,"): function returned an error", e);
						return "";
					}
				}

				// Expand with `scope` if passed in.
				if (value && scope) {
					if (typeof value === "string") {
						value = ""+value.expand(scope);
					} else {
						console.error("Message.get(",key,",",scope,"): scope specified but value is not a string! ",value);
					}
				}
				return value;
			},
			enumerable 		: false,
			configurable	: false,
			writeable		: false
		}),

		// `Messages.set(messages)`
		// Merge a bunch of new `messages` with the Messages singleton.
		set : Property({
			value : function(messages) {
				Property.merge(this, messages);
			},
			enumerable 		: false,
			configurable	: false,
			writeable		: false
		}),

		// `Messages.toString()`
		toString : Property({
			value : function() {
				return "[Messages]";
			},
			enumerable 		: false,
			configurable	: false,
			writeable		: false
		}),

	});

	var Messages = new constructor();
	Messages.set({
		test  : "I am a test message",
		nested : {
			message1 	: "ONE",
			message2	: "TWO"
		}
	});

	// Make the singleton globally available.
	Module.globalize("Messages", Messages);

	return Messages;

});	// end Module.define("studio/Messages")

