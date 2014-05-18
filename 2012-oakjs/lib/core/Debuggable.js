/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	hack in a 'debuggable' mixin inline
//
Module.define("oak/lib/core/Debuggable", "oak/lib/core/Mixin",
function(Mixin) {
	var Debuggable = {
		makeDebuggable : function (target, prefName) {
	//console.warn("Mixin.makeDebuggable(",target,prefName,")");
			if (!target)   throw "(Mixin.js):  You must specify a target when using Mixin.makeDebuggable()";

			// if being called on an instance of a class, attach to the CLASS, not the instance
			if (target.asThing) target = target.constructor;

			if (!prefName && typeof target === "function") prefName = target.name;
			if (!prefName) prefName = target.id;
			if (!prefName) throw "(Mixin.js):  You must specify a preference name when using Mixin.makeDebuggable() "+target;

			if (Mixin.debug) console.info("(Mixin.js):  Mixing 'Debuggable' in to ",target," with prefName '",prefName,"'");

			if (!prefName.endsWith(".__debug__")) prefName += ".__debug__";

			target.debug = Browser.preference(prefName);
			target.setDebug = function(newValue) {
				return Browser.preference(prefName, !!newValue);
			}
		}
	};
	return Mixin.addMixin("Debuggable", Debuggable, "makeDebuggable", Debuggable.makeDebuggable);
});
