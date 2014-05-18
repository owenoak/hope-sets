/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


//
//	(roughly) AMD-compatible module loader.
//				(see https://github.com/amdjs/amdjs-api/wiki/AMD)
//
//	NOTE: this file is dependent on jQuery, which MUST be loaded first!
//
//	Once you've included this file, you can do:
//		require("some/other/file")
//	to load that file as a "module", including all of its dependencies.
//
(function() {
// begin hidden from global scope

// set to true to debug module loading
var debugModule = false;

// "global" window pointer
// TODO: won't work in node!
var global = window;

if (!global.localStorage) {
	console.warn("(Module.js):  localStorage is not defined!");
	global.localStorage = {};
}

// Patch function.bind() for dumb browsers which don't include it (*cough* iOS *cough*)
if (!Function.prototype.bind) {
	// Define function.bind() as per ES5 spec (more or less)
	// NOTE: this does NOT work for binding a constructor for use with `new`.
	Function.prototype.bind = function F_P_bind(scope, arg1, arg2, etc) {
		var method = this;
		// convert arguments 1...n to real array
		var boundArgs = (arguments.length > 1 ? Array.prototype.slice.call(arguments, 1) : null);
		return function bound() {
			var args = (boundArgs ? Array.prototype.concat.apply(boundArgs, arguments) : arguments);
			return method.apply(scope, args);
		};
	};
}


// Parser for a module ID which splits in to:
//	1	= type prefix with !
//	2	= type prefix WITHOUT !
//	3	= module id
var MODULE_ID_PARSER = /^(([\w\.]+)!)?(.*)$/;

// flag constructor for when we load a JS file without an associated define()
function ANONYMOUS_MODULE_RETURN(){}

function Module(moduleId, dependencies, factory, value) {
	// prototype setup
	if (arguments.length === 0) return this;

//if (debugModule) console.warn("new Module(): ",arguments);

	// verify arguments
	if (this === global) throw "(Module.js):  Module("+moduleId+"):  MUST call as new Module()";

	// split "TYPE!MODULEID" apart
	var match = (moduleId.match ? moduleId.match(MODULE_ID_PARSER) : null);
	if (!match) throw "(Module.js): new Module('"+moduleId+"'): don't understand id";
	var type = match[2];
	var id = match[3];

	var module = this;
	// if there is an EXISTING module with this id, enhance that one rather than creating a second.
	var existingModule = (Module.ALL[moduleId] || Module.ALL[id]);
	if (existingModule) {
		console.warn("new Module(",arguments,"): Attempting to create a second module with id ",moduleId);
// TODO: what should we do here???
		module = existingModule;
	}

	//	NOTE: arguments are in this order for pretty printing in firebug
	module.id = id;
	module.WAITING_ON = [];
	if (type) module.type = type;
	module.isLoaded = false;
	module.setDependencies(dependencies || []);

	// remember under the shorter module id
	Module.ALL[module.id] = module;
	// if the full moduleId passed in is different, set that as an alias
	if (moduleId !== module.id) this.addAlias(moduleId);

	// if factory function is defined, set that up now
	if (factory) {
		module.setFactory(factoryOrValue);
	}

	// if a value was passed in, that means we're effectively loaded already
	if (value) {
		module.loadedWithValue(value);
	}

	if (debugModule) console.info("new Module(",module,")");

	return module;
}

// Get a Module by module id. Creates one if necessary.
Module.get = function(moduleId) {
	if (moduleId instanceof Module) return moduleId;

	if (typeof moduleId === "string") {
		if (moduleId === "") return;

		var id = (moduleId.match(MODULE_ID_PARSER)||[])[3];
		return (Module.ALL[id] || new Module(moduleId));
	}
	throw "Module.get("+moduleId+"):  moduleId not understood";
};



// Marker object, created when you define() a module but don't provide a factory() function.
Module.AnonymousModuleReturn = function AnonymousModuleReturn(){};


// instance properties/methods
Module.prototype = new Module();
$.extend(Module.prototype, {
	// Id of this module.
	id : undefined,

	// List of Modules we depend on.
	dependencies : undefined,

	// The "value" of this module -- the object returned by our factory during our define().
	value : undefined,

	// type of module file (redundant with extension?)
	type : "javascript",

	// file extension
	extension : ".js",

//
//	load semantics
//

	// Have we been loaded?
	isLoaded : false,
	isLoading : false,
	loadError : undefined,

	// Load us, which will initialize when we're done loading.
	//	Returns a promise which will complete when we're done loading.
	load : function() {
		if (this.isLoaded || this.isLoading) return new $.Deferred();
		this.isLoading = true;

		var module = this, url = this.getUrl(), promise;
		// javascript file
		if (url.contains(".js")) {
			promise = Module.loadScript(url, true)
						.done(this.checkDependencies.bind(this))
						.fail(function(){console.error("Module "+module.id+" failed to load!", module)});

			// if a package and we're attempting to load the combined file
			//	have a fallback which will load the package loader file instead.
			if (this.type === "package" && !Module.debugPackage(module.id)) {
				promise.fail(function() {
					console.warn("Failed to load combined package file ",module.id,"; loading package.js file");
					// TODO: Put this in a better spot, or add logic to only call when debugging.
					// This is breaking only IE, and is only useful for debugging.
					// Module.debugPackage(module.id, true);
					// module.reload();
				});
			}
		}

		// css file
		else if (url.contains(".css")) {
			promise = Module.loadCSS(url)
						.done(function(linkElement) {
							this.loadedWithValue(linkElement);
						}.bind(this));
		}

		// html templates
		else if (url.contains(".template.html") || url.contains(".templates.html")) {
			if (debugModule) console.info(this+"loading as html templates");
			promise = Module.loadTemplates(url)
						.done(function(templates) {
							this.loadedWithValue(templates);
						}.bind(this));
		}

		// something else -- load via ajax
		else {
			if (debugModule) console.info(this+"loading as a GET");
			promise = $.ajax({type:"GET", url:url})
							.done(function(requestText) {
								this.loadedWithValue(requestText);
							}.bind(this));
		}
		return promise;
	},

	// Force a re-load of this module.
	//	Whether this makes sense in terms of your script content is up to you!
	reload : function() {
		this.isLoaded = this.isLoading = false;
		this.load();
	},

	getUrl : function() {
		return Module.getUrlForModule(this);
	},

//
//	aliases for this module -- other modules names which mean the same thing
//
	aliases : undefined,
	addAlias : function(aliasId) {
		if (!this.aliases) this.aliases = [];
		this.aliases.push(aliasId);
		Module.ALL[aliasId] = this;
	},


//
//	dependencies
//
	// Set our list of dependencies.  Inflates them to a list of actual Module objects.
	//	We will automatically watch any dependencies which have not yet been loaded
	//	 so we will be notified when they're done loading.
	setDependencies : function(dependencies) {
		// expand dependency strings to Modules
		this.dependencies = Module.getAll(dependencies);

		// for any that are not loaded, watch for their loaded event to see if we can load
		__forEach__(this.dependencies, function(dependency) {
			dependency.addDependent(this);
			if (!dependency.isLoaded) {
				// debug
				if (!this.WAITING_ON) this.WAITING_ON = [];
				this.WAITING_ON.push(dependency);
			}
		}, this);
	},

	addDependent : function(dependent) {
		if (!this.dependents) {
			Module.DEPENDENTS[this.id] = this.dependents = [];
		}
		if (this.dependents.indexOf(dependent) === -1) this.dependents.push(dependent);
	},

	// Initialize us if all of our dependencies have already been loaded.
	checkDependencies : function(triggerModule) {
		// if we were passed a trigger module and we're still waiting on someone to complete
		if (triggerModule != this && triggerModule instanceof Module && this.WAITING_ON) {
			// if we're waiting on the trigger module, remove it from our WAITING_ON list
			var index = this.WAITING_ON.indexOf(triggerModule);
			if (index !== -1) {
				if (debugModule) console.warn(this+"loaded dependency "+triggerModule);
				this.WAITING_ON.splice(index, 1);
			}
		}
		if (!this.isLoaded && Module.areLoaded(this.dependencies)) return this.onAllDependenciesLoaded();
	},


	// Our dependencies have finished loading -- initialize our "value" from our "factory"
	//	and notify any observers that we've loaded.
	onAllDependenciesLoaded : function() {
		Module.LOAD_ORDER.push(this);
//console.info(this.id);
		if (this.isLoaded) return console.warn(this+".onAllDependenciesLoaded():  we've already been loaded");
		if (debugModule) console.log(this+".onAllDependenciesLoaded()!");
		// actually call our factory function with our dependencies as arguments
		var dependencies = __map__(this.dependencies, Module.getValue);

		// some modules don't actually have a factory method
		//	in which case they should set our value manually in module.load()
		if (this.value) {
			this.loadedWithValue(this.value);
		} else {
			var value;
			if (this.factory) {
				value = this.factory.apply(this, dependencies);
			} else {
				value = new ANONYMOUS_MODULE_RETURN();
			}
			this.loadedWithValue(value);
		}
	},


	// We've finished loading the module with a particular value.
	//	Set things up and notify any observers that we've finished the load.
	loadedWithValue : function(value) {
		if (value == null) {
			console.error(this+".onAllDependenciesLoaded(): define factory method didn't return a value!");
		}

		this.value = value;
//console.debug(this.id, value);

		this.isLoaded = true;
		this.isLoading = false;
		delete this.WAITING_ON;

		// tell anyone who is dependant on us that we've finished loading!
		var dependents = Module.DEPENDENTS[this.id];
		__forEach__(dependents, function(dependent) {
			dependent.checkDependencies(this);
		}, this);
	},

//
//
//

	setFactory : function(factory) {
		this.factory = factory;
	}

});
Module.prototype.toString = function() {
	return "[module "+this.id+"]";
};


// static properties/methods
$.extend(Module, {
	// map of moduleId => Module object for each module which is define
	ALL : new (function MODULE_ALL(){}),

	// map of moduleId -> dependants for that module
	//	(for debugging)
	DEPENDENTS : new (function MODULE_DEPENDENTS(){}),

	// list of modules which finished loading, in order
	LOAD_ORDER : [],

	// Cache parameter used to defeat caching whenever we load any Modules.
	//	NOTE: if you want to defeat caching, in your Module init script,
	//			set Module.cacheParam to, eg, "_={SOMEDATE}"
	//			BEFORE you start loading any modules.
	cacheParam : "",

	//	URL prefixes you can use in your URLs as shortcuts (or to maintain environment independence).
	//	See `module.setUrlPrefix()` and `module.mungePath()`.
	URL_PREFIXES : {},

//
//	global variables
//

	getGlobal : function(name) {
		return global[name];
	},

	// Given some resource, make a pointer to it in the global space.
	//	You should ALWAYS use this rather than setting window.foo to something!
	globalize : function(name, it) {
//		console.info("Globalizing ",name," as global."+name);
		return (global[name] = it);
	},

//
//	urls
//

	// base URL RELATIVE TO THE LOADING PAGE for all resources
	baseUrl : "",

	getUrlForModule : function(module) {
		var url = module.id,
			type = module.type
		;

		// something package related?
		if (url.contains(":")) {
			// if it ends with a ":", then it's a package itself
			if (url.charAt(url.length-1) === ":") {
				type = "package";
				url = url.replace(":", "");
				// if it ends with a slash, assume that we want the "all" package.
				if (url.charAt(url.length-1) === "/") {
					url += "all";
				}
			}
			// file from a package -- just get rid of the slash.
			else {
				url = url.replace(":", "");
			}
		}
		switch (type) {
			case "javascript":
				if (!url.contains(".js")) url += ".js";
				break;

			case "css":
				if (!url.contains(".css")) url += ".css";
				break;

			case "package":
				if (debugModule) console.info("loading package ",module.id);

				// if debugging the package, load the "package.js" which includes individual files
				if (this.debugPackage(module.id)) 	url += ".package.js";
				// otherwise load the pre-compiled ".js" file
				else								url += ".js";
				break;
		}

		url = this.mungePath(url);
		url = this.addCacheParam(url);
		return url;
	},

	// Add our cache parameter to the url specified.
	addCacheParam : function(url) {
		if (!this.cacheParam || url.contains(this.cacheParam)) return url;
		return url + (url.contains("?") ? "&" : "?") + this.cacheParam;
	},


	// Should we be debugging packages, loading them as separate JS files?
	//	- pass a @packageName + @newValue to turn debugging on or off
	//	- pass just a @packageName to get the current state for that package
	//	- pass no arguments to see what we're debugging
	defaultDebugPackage : false,
	debugPackage : function(packageName, newValue) {
		if (!packageName) {
			var packages = [];
			for (var key in localStorage) {
				if (key.startsWith("Module.debugPackage:")) {
					if (localStorage[key] === "true") {
						packages.push(key.replace("Module.debugPackage:",""));
					}
				}
			}
			if (packages.length) {
				console.info("Package debugging is ON for ",packages);
			} else {
				console.info("Package debugging is OFF for ALL PACKAGES");
			}

		} else {
			var prefName = "Module.debugPackage:"+packageName;
			if (newValue != null) {
				localStorage[prefName] = !!newValue;
			}
			if (localStorage[prefName] === "true") return true;
			if (localStorage[prefName] === "false") return false;
			return Module.defaultDebugPackage;
		}
	},


	// Set up a urlPrefixName -> urlString mapping for use in Module.expandUrl() and Module.mungePath()
	// NOTE: urlString can have other urlPrefixes in it (eg:  {CDN}foo )
	//		 which will be expanded for you automatically.
	setUrlPrefix : function(urlPrefixName, urlString) {
		// if
		urlString = Module.expandUrl(urlString);
		Module.URL_PREFIXES["{"+urlPrefixName+"}"] = urlString;
	},

	// Set up a map of urlPrefixName -> urlString mapping for use in Module.expandUrl() and Module.mungePath()
	setUrlPrefixes : function(map) {
		for (var key in map) {
			Module.setUrlPrefix(key, map[key]);
		}
	},

	// Apply any URL prefixes in our URL_PREFIXES map to the URL.
	// If you pass in a `context` object, we'll do an `expand()` against that first.
	expandUrl : function(url, context) {
if (url == null) {
	console.error("Module.expandUrl(): called with null url");
	return "";
}
		if (context && url.expand) url = url.expand(context);
		for (var prefix in Module.URL_PREFIXES) {
			url = url.split(prefix).join(Module.URL_PREFIXES[prefix]);
		}
		return url;
	},

	// Given a path, munge it into a better one.
	// TODOC...
	mungePath : function(url) {
		url = this.expandUrl(url);
		if (url.startsWith("http") || url.startsWith("/")) return url;
		return this.baseUrl + url;
	},

	// Get the loaded result for a module.
	//	Returns undefined if the module hasn't finished loading.
	getValue : function(module) {
		if (module) {
			if (typeof module === "string") module = Module.get(module);
			if (module instanceof Array) return __map__(module, Module.getValue);
			return module.value;
		}
	},

	// Get the id for a module.
	getId : function(module) {
		if (module) {
			if (typeof module === "string") return module;
			if (module instanceof Array) return __map__(module, Module.getId);
			if (module.id) return module.id;
		}
	},

	// Given either:
	//		- a string which contains a list of module id, or
	//		- an array containing string module ids or a Modules, or
	//		- a single Module
	//	return
	//		- an array of Modules, creating any modules as necessary
	getAll : function(modules) {
		if (modules instanceof Module) return [modules];
		if (!modules) return [];
		if (typeof modules === "string") modules = modules.split(/\s*,\s*/g);
		if (modules instanceof Array) {
			return __map__(modules, Module.get);
		}
		// assume it's a map of key/value pairs
		else {
			var result = [];
			for (var key in modules) {
				var value = Module.get(modules[key]);
				if (value) result.push(value);
			}
			return result;
		}
	},

//
//	figuring out which modules of a set are loaded, etc
//

	// Return true if all of a given set of modules are already loaded.
	//	NOTE: returns true for an empty set of modules (which is what you want).
	areLoaded : function(modules) {
		return Module.getAll(modules).every(Module.getValue);
	},

	// Given a set of modules, return the VALUE for all the ones which ARE loaded
	getValues : function(modules) {
		if (!modules) modules = Module.ALL;
		return __map__(Module.getAll(modules), function(module) {
			if (module.isLoaded) return module.value;
		});
	},

	// Given a set of modules, return all the ones which ARE loaded
	getLoaded : function(modules) {
		return __map__(Module.getAll(modules), function(module) {
			if (module.isLoaded) return module;
		});
	},

	// Given a set of modules, return any which are NOT currently loaded.
	getUnloaded : function(modules) {
		if (!modules) modules = Module.ALL;

		modules = Module.getAll(modules);
		return __map__(modules, function(module) {
			if (!module.isLoaded) return module;
		});
	},

	// Given a set of modules, return any which are waiting on other things.
	getWaiting : function(modules) {
		if (!modules) modules = Module.ALL;

		modules = Module.getAll(modules);
		return __map__(modules, function(module) {
			if (!module.isLoaded && (!module.WAITING_ON || module.WAITING_ON.length > 0)) return module;
		});
	},

	// Print a graph of who is still waiting on what.
	waiting : function(modules) {
		var waiting = Module.getWaiting(modules);
		if (waiting.length === 0) {
			return console.info("Nobody's waitin on nuthin!");
		}
		__forEach__(waiting, function(module) {
			console.group("Module "+module.id+" is waiting on:");
			__forEach__(module.WAITING_ON, function(waitedOn) {
				// only output children who are actually waiting on something else
				//	this covers package file cases
				if (waitedOn.WAITING_ON.length > 0) console.warn(" - Module "+waitedOn.id, waitedOn);
				else								console.log(" - Module "+waitedOn.id);
			});
			console.groupEnd();
		});
	},


//
//	AMD require() syntax
//

	// Simple class for creating persistent 'require' objects, for debugging
	RequireConstructor : function Require(){},

	// Require one or more modules, performing a callback when they finish.
	//	Also returns a promise() which will resolve() when they all finish.
	require : function(modules, callback, module) {
		// default no-op callback (simplifies the code below).
		if (!callback) callback = function(){};

		// figure out which of the modules still need to be loaded
		var require = new Module.RequireConstructor();
		require.modules = modules;
		require.unloaded = Module.getUnloaded(modules);

		require.promise = new $.Deferred();

		// method executed after each load of our dependencies
		//	which will call our require function when they've loaded
		require.checkDependencies = function() {
			// reduce down to the list of currently unloaded callbacks
			require.unloaded = Module.getUnloaded(require.unloaded);
			if (!require.unloaded.length) {
				var value = callback.apply(global, Module.getValues(modules));
				require.promise.resolve(value);
			}
		};

		// load all of the unloaded dependencies, and call ourselves back when they load
		__forEach__(require.unloaded, function(unloaded) {
//if (debugModule) console.info("require.unloaded ",unloaded);
			if (!module) unloaded.addDependent(require);
			if (!unloaded.isLoading) {
				unloaded.load();
			}
		}, this);

		// perform the initial check, which may finish immediately
		require.checkDependencies();

		return require.promise;
	},


	// Define a module.  moduleId and factory are mandatory!
	// TODO: infer moduleId?  huh???
	define : function(moduleId, dependencies, factory) {
		// argument swizzling
		if (typeof moduleId === "function") {
			throw "[Module.js]  define() doesn't yet work without specifying a moduleId";
		}
		if (typeof dependencies === "function") {
			factory = dependencies;
			dependencies = null;
		}
	//	if (!factory) throw "define("+moduleId+"): factory function not found";
//if (debugModule) console.log("Module.define(",moduleId, ",", dependencies, ",", factory,")");

		// create (or update) the module for this module id
		var module = Module.get(moduleId);
		if (dependencies) module.setDependencies(dependencies);
		if (factory) module.setFactory(factory);

		var unloadedDependencies = Module.getUnloaded(module.dependencies);
		if (unloadedDependencies.length) {
			if (debugModule) console.group("define(",moduleId,") is loading dependencies:", unloadedDependencies);
			Module.require(module.dependencies, null, module);
			if (debugModule) console.groupEnd();
		} else {
			if (debugModule) console.debug("define(",moduleId,") is all dependencies loaded");
			module.onAllDependenciesLoaded();
		}
	},

	// Define a "package" of things, which we will generally load together.
	//	The "value" of the package is a mapping of all of the dependencies "values".
	//
	//	If dependencies are an array:
	//		- Each is both the "key" for the dependency and the moduleId suffix for the dependency.
	//		- Dependencies MUST be JS files and MUST be local to the package.
	//	If dependencies are an object:
	//		- You can mix JS, HTML, CSS, etc files together (eg: "html!blah").
	//		- The "key" in the dependency map is the key for that dep. in the package value.
	//		- The "value" in the dep. map is the module id for that dependency.
	//		- If the module id starts with "/", the module is assumed to be relative to the ENCLOSING HTML FILE.
	//		- If the module id starts with "http", it is assumed to be any random HTML file.
	//
	//	If you provide a callback, it will be executed at the end with the dependency map
	//	 BEFORE the package itself returns.
	//
	definePackage : function(packageId, dependencies, callback) {
		// normalize packageId
		var packageModuleId = packageId.replace(":", "");
		// if module ends with a slash, assume we want the "all" package
		if (packageModuleId.endsWith("/")) packageModuleId += "all";
		// stick the colon back on
		packageModuleId += ":";

		// the base for the dependencies is the packageModuleId MINUS THE LAST PATH ITEM, WITHOUT THE COLON
		var dependencyBase = packageModuleId.substring(0, packageModuleId.lastIndexOf("/")) + "/";

		var packageModules = {};			// map of id => module
		var packageDependencies = [];		// list of dependency package ids

		// figure out the expanded set of dependencies
		//	we'll normalize the dependencies passed in and store them temporarily in 'deps'
		var deps = {};
		var id, standaloneId;
		//	- if an array, we've just got a simple list which specifies both id & moduleId
		if (dependencies.length) {
			__forEach__(dependencies, function(id) {
				deps[id] = dependencyBase + id;
			});
		}
		//	- if an object, we've got id => moduleId tuples
		else {
			var match, moduleType, moduleId;
			for (id in dependencies) {
				standaloneId = dependencies[id];
				// handle different types of modules (eg: "html!blah")
				match = standaloneId.match(MODULE_ID_PARSER);
				moduleType = (match[1] || "");
				moduleId = match[3];

				if (moduleId.startsWith("/") || moduleId.startsWith("http")) {
					deps[id] = standaloneId;
				} else {
					deps[id] = moduleType + dependencyBase + moduleId;
				}
			}
		}

		// create the modules and set things up for our callbacks
		var depIds = [];
		for (id in deps) {
			standaloneId = deps[id];
			var pkgId = packageId + id;
			var module = Module.get(standaloneId);	// create the module under the standalone name
			module.addAlias(pkgId);					// add an alias under the package id
			depIds.push(pkgId);						// add to the list of dependencies for the package
		}

		// method put the dependency values back into an object
		//	and run the callback passed in to definePackage()
		// This is the "factory" method of the package itself.
		function packageFactory() {
			var actualValues = {};
			for (var id in deps) {
				actualValues[id] = Module.get(deps[id]).value;
			}

			// execute any callback BEFORE setting the value for the package (???)
//TODO: is this the right order?
			if (callback) callback(actualValues);

			// returning the actualValues map here will set the value of the package itself
			return actualValues;
		}

		// defer out to a regular Module.define()
		Module.define(packageModuleId, depIds, packageFactory);
	},

	//
	//	Pre-load a bunch of modules together;
	//	 this generally means you've mashed them together into one file for download speed.
	//	If you preload() the package module, it will avoid loading individual modules as separate files.
	//
	//	The Module.preload() call must occur BEFORE the actual inlined scripts for this to help efficiency.
	//
	preload : function(moduleId, dependencies, factory, value) {
		// create modules for all dependencies...
		dependencies = Module.getAll(dependencies);
		// ... and tell them that they're already loading
		__forEach__(dependencies, function(module) {
			if (!module.isLoaded) module.isLoading = true;
		});

//console.info(dependencies);

		Module.define(moduleId, dependencies, factory, value);
	},

//
//	generic script/css/etc which returns a promise to load a resource
//

	//
	//	Inline a script tag from some src after page load, in a debuggable fashion.
	//	@url	= URL (fully qualified or local to window.location) to load
	//	@return	= A promise which will be resolved (with boolean `true`) when the script finishes loading.
	//			  Note that in IE there is no way to know reliably that the script has NOT loaded.
	//
	loadScript : function(url, async) {
/*
		return $.ajax({  url:url, dataType: "script", cache:true, crossDomain:true })
				.done(function() {
					console.log("Module.loadScript("+url+") completed with arguments", arguments);
				})
				.fail(function() {
					console.error("Module.loadScript("+url+") failed with arguments", arguments);
				});
*/


		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src = url;
		if (async) script.async = true;

		// promise to resolve when the script finishes loading
		var promise = new $.Deferred();

		// standards browsers
		if (script.addEventListener) {
			script.onload = function (event) {
					if (debugModule) console.info("Module.loadScript(",src,") COMPLETED");
					promise.resolve(true);
					if (debugModule) console.groupEnd();
				};
			script.addEventListener("error", function() {
					if (debugModule) console.error("Module.loadScript(",src,") FAILED", script);
					promise.reject();
					if (debugModule) console.groupEnd();
				}, false
			);
		}
		// old(?) versions of IE
		else {
			script.onreadystatechange = function (event) {
				if (script.readyState === "loaded" || script.readyState === "complete") {
					if (debugModule) console.info("Module.loadScript(",src,") COMPLETED");
					promise.resolve(true);
					// clean up IE memory leak ???
					script.onreadystatechange = null;
					if (debugModule) console.groupEnd();
				}
			};
		}

		if (debugModule) console.group("Module.loadScript(",src,",",async,")");
		// append to the DOM once everything is set up, which starts the load
		document.getElementsByTagName("head")[0].appendChild(script);

		return promise;
	},


	//
	//	Inline a CSS file and return a promise which will be resolved when it loads.
	//	Nod to:  http://www.backalleycoder.com/2011/03/20/link-tag-css-stylesheet-load-event/
	loadCSS : function(url) {
		// add cache parameter, or Chrome will cache over-aggressively
		url = this.addCacheParam(url);

		// create the <link> tag which loads the stylesheet and add it to the HEAD
		var $link = $("<link type='text/css' rel='stylesheet' href='"+url+"'>");
		$("head").append($link);

		var promise = new $.Deferred();
		if (Browser.is.tide) {
			// the img tag onerror hack doesn't work in tide, so just poll every 20ms for the
			// link element to have its sheet property set.
			var intv = setInterval(function() {
				if ($link[0].sheet) {
					clearInterval(intv);
					promise.resolve($link[0]);
				}
			}, 20);
		} else {
			// MAJOR HACKAGE!
			// Load the same file in an IMG tag, which will fail because it's not an image mime type.
			//	This calls img.onerror, which we use to resolve the promise!
			var img = document.createElement('img');
			img.onerror = function(){	promise.resolve($link[0]);	};
			img.src = url;
		}

		return promise;
	},

	// Load as a bunch of HTML template strings.
	loadTemplates : function(url) {
		url = this.addCacheParam(url);
		var promise = new $.Deferred();

		$.ajax({type:"GET", url:url})
			.done(function(requestText) {
				var results;
				var $html = $(requestText);

				// attempt to find <template> elements in the requestText
				//	if we find any, make a map of them by id and return that
				var $templates = $html.filter("template");
				if ($templates.length > 0) {
					results = {};
					$templates.each(function(index, template) {
						var $template = $(template);
						var id = $template.attr("id");
						if (id) {
							var html = $template.html();
							if ($template.attr("eatwhitespace")) {
								html = html.trim().replace(/>\s+</g, "><");
							}
							results[id] = html;
						}
					});
				}
				// otherwise return the entire blob as a string
				else {
					results = requestText;
				}
				promise.resolve(results);
			}).fail(function() {
				promise.reject();
			});
		return promise;
	},



	// Attempt to find a <script> tag in the body
	//	which has a 'src' attribute which CONTAINS @src.
	//	If we find one, eval() it to execute it immediately.
	executeInlineScriptBody : function(src) {
		$("script").each(function(index, script) {
			var $script = $(script);
			if (($script.attr("src") || "").contains(src)) {
				var javascript = $script.text();
				/* jshint -W061 */// don't complain about eval, we know it is evil
				if (javascript) eval(javascript);
				/* jshint +W061 */
			}
		});
	},


//
//	debug
//
	// return a map of all known modules and their values
	debugValues : function() {
		var values = {};
		for (var key in Module.ALL) {
			values[key] = Module.ALL[key].value;
		}
		return values;
	},

	// list unloaded modules
	debugUnloaded : function() {
		var unloaded = Module.getUnloaded(Module.ALL);
		if (!unloaded.length) {
			console.info("All packages are loaded!");
		} else {
			console.group("Unloaded packages:");
			unloaded.forEach(function(module) {
				console.debug(module);
				var list;
				if (module.dependencies.length) {
					list = module.dependencies.map(function(module){return module.id;});
					console.debug("    dependencies: ",list);
				}
				if (module.dependents.length) {
					list = module.dependents.map(function(module){return module.id || "anonymous module";});
					console.debug("    dependents:", list);
				}
			});
			console.groupEnd();
		}
	},

	// return load order for set of currently-loaded modules
	debugLoadOrder : function() {
		return __map__(Module.LOAD_ORDER, Module.getId);
	}

});



//
//	syntactic sugar for arrays and strings, since they are not guaranteed to be defined everywhere...
//

// Call a method on each element in an array, returning the results of the method.
// Skips null items in the source array and null results in the resulting array.
function __map__(array, method, scope) {
	var results = [];
	if (!scope) scope = global;
	if (array && array.length) {
		for (var i = 0, last = array.length; i < last; i++) {
			var it = array[i];
			if (it != null) {
				var result = method.call(scope, it, i, array);
				if (result != null) results.push(result);
			}
		}
	}
	return results;
}

// Call a method on each non-null element in an array.  No return value.
function __forEach__(array, method, scope) {
	__map__(array, method, scope);
}


// Add "contains" to the string.prototype, 'cause that's how we roll.
if (!String.prototype.contains) {
	String.prototype.contains = function(substring) {
		return this.indexOf(substring) !== -1;
	};
}
// Add "startsWith" to the string.prototype, 'cause that's how we roll.
if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(substring) {
		return this.indexOf(substring) === 0;
	};
}
// Add "endsWith" to the string.prototype, 'cause that's how we roll.
if (!String.prototype.endsWith) {
	String.prototype.endsWith = function(substring) {
		if (typeof substring !== "string") return false;
		if (substring === "") return true;
		return (this.substr(substring.length * -1) === substring);
	};
}



// Create a Module for Module.js and mark it as loaded with itself!!!
new Module("oak/lib/core/Module", null, null, Module);

// Make a global pointer to Module
Module.globalize("Module", Module);

//
// Syntactic sugar in the AMD pattern:
//		https://github.com/amdjs/amdjs-api/wiki/AMD
Module.define.amd = {};
Module.globalize("define", Module.define);

Module.require.toUrl = Module.mungePath;
Module.globalize("require", Module.require);


// Define an "APP" url prefix which points to our app's path
var appPath = window.location.pathname.substr(0, window.location.pathname.lastIndexOf("/")+1);
Module.setUrlPrefix("APP", appPath);

// add an empty {version} URL prefix to eat {version} bits at the end of urls.
// NOTE: some apps may override this!
Module.setUrlPrefix("version", "");
Module.setUrlPrefix("VERSION", "");


// Execute any code in the <script src='.../Module.js'> element.
//	This is a good place to set up config parameters or do app-level require()s!
Module.executeInlineScriptBody("Module.js");


// end hidden from global scope
})();
