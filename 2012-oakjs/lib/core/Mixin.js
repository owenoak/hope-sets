/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Create a mixin from a set of propeties.
//
Module.define("oak/lib/core/Mixin",
"oak/lib/js/Object,oak/lib/core/Property",
function(Object, Property) {

	// mixin constructor
	function Mixin(mixinName, properties, makeMethod) {
		if (Mixin.debug) console.group("(Mixin.js):  new Mixin(",arguments,")");

		// create a throw-away function with the proper name so Firebug will output the properties
		//	with the name of the mixin
		var tempConstructor;
		eval("tempConstructor = function Mixin_"+mixinName+"(map){for (key in map){this[key] = map[key]}}");
		var mixin = new tempConstructor(properties);
		tempConstructor.id = mixinName;

		// define a non-enumerable toString method on the Mixin itself, for debugging.
		Object.defineProperty(mixin, "toString", {
			enumerable:false,
			value : function() {
				return "[Mixin "+mixinName+"]";
			}
		});

		// create an "as<mixinName>" method which allows you to call mixin methods explicitly
		Object.createAsMethod(mixinName, mixin, mixin);

		// if we didn't get one, create a function  Mixin.make<mixinName>
		//		e.g.  Mixin.makeLoadable()
		//	which applies the mixin to some object.
		var makeMethodName = "make"+mixinName;
		if (Mixin.debug) console.info("(Mixin.js):  mix it into something via Mixin."+makeMethodName);
		if (!makeMethod) {
			makeMethod = function(target) {
				if (!target) throw "(Mixin.js):  Mixin."+makeMethodName+"(",arguments,"): target is not defined";

				// If called on a class, mix in to the class prototype.
				if (typeof target === "function") target = target.prototype;
				if (Mixin.debug) console.info("(Mixin.js):  Mixing '"+mixinName+"' in to ",target);

	//console.info(target, mixin);
				Property.extend(target, mixin);
				if (target.constructor && target.constructor.protoChain) target.constructor.protoChain.prepend(mixin);
				return target;
			}
		}

		Mixin.addMixin(mixinName, mixin, makeMethodName, makeMethod);
		if (Mixin.debug) console.groupEnd();

		return mixin;
	}

	Property.extend(Mixin, {
		INSTALLERS : {},

		addMixin : function(name, mixin, makeMethodName, makeMethod) {
			Mixin[name] = mixin;
			Mixin[makeMethodName] = makeMethod;
			Mixin.INSTALLERS[name] = makeMethod;
			return mixin;
		},

		// Add a map of properties to this object, but ONLY if that property is not already defined on the object.
		mixinTo : function (thing, map) {
			if (!thing || !map) return thing;

			// if they specified a string, assume it's a mixin name from Mixin.INSTALLERS
			if (typeof map === "string") map = map.split(/\s*,\s*/g);
			if (map.forEach) {
//console.warn(thing, map);
				map.forEach(function(mixinName) {
					var method = Mixin.INSTALLERS[mixinName];
					if (method) {
						method(thing);
					}
					else {
						console.warn("(Mixin.js):  ",thing,".mixin("+mixinName+"): mixin Mixin.INSTALLERS."+mixinName+" is not defined");
					}
				});
			} else {
//console.info(thing, map);
				Property.extend(thing, map);
			}
			return thing;
		}
	});

	Module.globalize("Mixin", Mixin);
	return Mixin;
});	//	end define("oak/lib/core/Mixin")

