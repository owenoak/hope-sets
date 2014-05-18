//
//	console... define if not defined in some environments
//
Module.define("oak/lib/js/console", function() {
	// no-op function for the below
	function noop() {}

	var konsole = Module.getGlobal("console");
	if (!konsole) {
		konsole = {
			log : noop
		}
		Module.globalize("console", konsole);
	}
	
	//  
	//  Console Fixes
	//  Certain browsers that we support (*cough* IE9 *cough*) don't have some
	//  console debugging/output functions that have been written into the
	//  front-end application. As a result, we need to check for them, and point
	//  them to nearest-equivalents, if such a thing exists.
	//  
	var methods = ["debug", "warn", "info", "error", "group", "groupCollapsed"];
	for (var i = 0; i < methods.length; i++) {
		var method = methods[i];
		if (!konsole[method]) konsole[method] = konsole.log;
	}
	// special case for groupEnd
	if (!konsole.groupEnd) konsole.groupEnd = noop;
	
	if (!konsole.dir)) {
		konsole.dir = function(it) {
			var propertyFound = false;
			for (var key in it) {
				propertyFound = true;
				var value = it[key];
				if (typeof value === "function") continue; //value = "<function>";
				konsole.log(key + " : " + value);
			}
			if (!propertyFound) konsole.log("  [object with no properties]");
		}
	}

	return konsole;
});	// end define("oak/lib/js/console")