/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


//
//	Generic Loadable mixin -- use as:
//
//	To make something loadable:
//		Class.makeLoadable(something)
//	 or
//		Class.makeLoadable(SomeClass)
//
//	To load it:
//	   something.load()
//
//		- You will be returned a jQuery Deferred (a.k.a "promise") which will be resolved
//			when the resource is loaded.
//
//		- To do something when the result finishes, you do something like:
//				yourThing.load().done(function(results){...})			// success callback
//								.fail(function(errorMessage){...})		// error callback
//
//		- If the thing is in the process of loading, you'll get the same loading promise
//			back -- you can just attach .done() or .fail() callbacks as above.
//
//		- If the thing has already been successfully loaded, you'll get a promise that returns right away
//			with the same results/errorMessage.
//
//		- NOTE: this will NOT attempt to reload something that has successfully loaded
//				you'll just get an immediate promise back.
//				Use:
//					yourThing.reload()		[which will reload but re-use old data if the reload fails]
//				or
//					yourThing.forceReload({parameters})	[which will unload and then reload]
//				to force a reload.
//
// TODO: VERIFY THE BELOW!!!!
//		- If you tried to load something before, and it failed, and you .load() again,
//			it will try again (eg: doesn't remember that there was an error before).
//
//	To see if something is loaded:
//			if (something.isLoading) {...}
//
//	To see if something is actively loading:
//			if (something.isLoading) {...}
//
//	To see if there was an error loading last time:
//			if (something.loadError) {...}
//
//	TODOC:
//		- autoReloadDelay
//		- cacheLoadDuration
//		- parseLoadedResults()
//		- parseLoadError()
//
Module.define("oak/lib/core/Loadable",
"oak/lib/core/Mixin",
function(Mixin) {

	// set to true to print out messages when load() pulls things from cache or not
	var DEBUG_LOAD = false;

	new Mixin("Loadable", {
		// Have we been loaded successfully?
		isLoaded : false,

		// Are we in the midst of loading?
		isLoading : false,

		// Error message (string) or result code (404) if our last load resulted in an error.
		// Will be `undefined` if we've never loaded, are loading or last load completed successfully.
		loadError : undefined,

		// indicator that we are loadable
		isLoadable : true,

		// Message to return as the result of a load failure.
		// Will be `expand()`ed with this object so you can stick parameters in the message.
		//  (and in the default below, `{{this}}` will be `loadable.toString()`).
		loadErrorMessage : "Error loading {{this}}",

		// If true, we'll ignore a load error, treating it as a load with no data.
		// This is useful, eg, if you're trying to load a file from the server,
		//	but you have fallback data if the file isn't defined yet.
		ignoreLoadErrors : false,

		// By default, we'll assume that the results of a `load()` are valid until you specifically do an `unload()` or `forceReload()`.
		// Thus we're basically caching the results of the last `load()` automatically.
		// Set `cacheLoads` to `false` to turn this off, where each `load()` will do another server round trip.
		// See also `cacheLoadDuration`.
		cacheLoadResponses : true,

		// If `cacheLoadResponses` is `true`, we'll by default assume that the cache is valid for all time.
		// If you instead want the cache to be valid for a limited time,
		//	specify a POSITIVE NUMBER OF SECONDS for `cacheLoadDuration` and we'll `reload()` if that amount of time
		//	has passed since the last load.
		cacheLoadDuration : -1,

		// Set to a POSITIVE NUMBER OF SECONDS to tell this instance to automatically reload periodically.
		// NOTE: this will only work if your last load succeeded!
		autoReloadDelay : -1,


	//
	//	Callbacks you'll likely want to override.
	//	NOTE: you should generally not override the generic `load()`, `unload()` etc
	//			unless you're doing something really exotic.
	//


		// Return the EXACT url to use to load this resource.
		//	Make this a Property.Getter if you want it to be dynamic.
		//	YOU MUST OVERRIDE THIS IF YOU ARE USING THE STANDARD LOADING PROMISE!
		//
		// Note that in the default implementation, the URL will be passed through `Module.expandUrl()`
		//	so that any url prefixes you've defined for your app (eg:  "{APP}" for the base path to your app).
		//
		//	Module.expandUrl(this.urlToLoad, this)
		//
		urlToLoad : "",


		// data type for loaded data:
		//		- "oxml"  for strict XML data
		//		- "ohtml" for owen-slacker-style xml and mixed html content
		//		- any other `jquery.ajax()` datatype	(see:  http://api.jquery.com/jQuery.ajax/)
		//	Note that IE8 has problems loading highly nested custom XML in "html" mode.
		loadedDataType : "ohtml",



		// Return a jQuery Deferred which will load this resource.
		//
		// If you're just loading a file or a making a straightforward server API call, simply:
		//		- override `urlToLoad` as a static string (or a Getter) to return the appropriate URL, and
		//		- set the loadedDataType if you want something other than 'ohtml'
		//	rather than overriding this.
		//
		//	When this promise is `resolve()`ed:
		//		- we'll send the results through `parseLoadedResults()` and return that as the `results` of the `load()`.
		//	When this promise is `rejected()`ed:
		//		- we'll send the results through `parseLoadError()` and return that as the `results` of the `load()`.
		//
		// See `loadable._getLoaderForUrl()` for details about data types and caching.
		getLoader : function() {
			return this._getLoaderForUrl(this.urlToLoad, this.loadedDataType);
		},

		// You've just started actualy loading.  Do something (eg: show a loading indicator, etc).
		// 	NOTE: This WILL NOT be called if a `load()` is producing cached data (and thus is not really loading again right now)
		//	NOTE: You only need to override this if you want to show a loading indicator, etc.
		onLoading : function() {},

		// The `loader` you created in `getLoader()` has just `resolve()`d.
		// Transform the data sent to you for consumption by folks who are consuming the `load()` promise.
		// NOTE: You should RETURN AN ARRAY of results.
		// NOTE: the default is just to pass back the first data argument as it came in.
		parseLoadedResults : function(result) {
if (DEBUG_LOAD) console.debug(this+".parseLoadedResults", arguments);
			if (arguments.length === 0) return [];
			return [result];
		},

		// The `loader` you created in `getLoader()` has just been `reject()`ed.
		// Transform the data sent to you for consumption by folks who are consuming the `load()` promise.
		// NOTE: You should RETURN AN ARRAY of results.
		// NOTE: the default is expand our `loadErrorMessage` with `this` and return that as a string.
		parseLoadError : function(jQueryAjaxCall) {
			var message = this.loadErrorMessage.expand(this);
if (DEBUG_LOAD) console.debug(this+".parseLoadError", arguments);
			return [message];
		},


		// You have finished loading!  Do something.
		//	`data` is the data that was returned by your loading promise, or by `parseLoadedResults()` if you implemented it.
		//	NOTE: You probably DO want to override this.
		onLoaded : function(data) {},

		// There was an error loading your stuff.
		//	`errorMessage` is the results of your `parseLoadError()` call.
		//	NOTE: You probably DO want to override this.
		onLoadError : function(errorMessage) {},

		// Release any memory/etc when we should be unloaded.
		// We'll pass the same arguments that our original `load()` were resolved with.
		//	NOTE: You only need to override this if you have any internal data structures to clear up on unload.
		onUnloaded : function(loadResults) {},




	//
	//	Generic functionality.  You should probably NOT override this stuff.
	//

		// Load me!
		//	Returns a promise so you can do something when the callback completes or fails.
		//  If `cacheLoadDuration` is set, we'll reload automatically if our cached data is stale.
		//
		// NOTE: you should almost NEVER override this, use the above properties or public methods instead.
		//
		load : function() {
if (DEBUG_LOAD) console.debug(this+".load()", arguments);
			// stop reload timer (will restart after a load completes)
			this._clearAutoReloadTimer();

			// check our internal cache state.
			// This may munge our old loader, etc.
			this._clearLoadCacheIfNecessary();

			// our `internalLoader`	is the generic deferred object we'll actually emit from the `load()` call
			//	which wraps the `dataLoader` defined on a class-by-class basis.
			var internalLoader = this._private.loader;

			// if we've been marked as loaded already
			//	 or we've already started the loading process (we'll have a 'loader')
			//	 just return the loader (making an empty one if necessary).
			if (this.isLoaded || this.isLoading) {
				// create a stubby loader if we don't already have one
				if (!internalLoader) {
					// create a stub internal loader
					internalLoader = $.Deferred();
					// resolve it if we think we're loaded already
					if (this.isLoaded) internalLoader.resolveWith(this, this._private.loadResults);
					// remember for next time
					this._private.loader = internalLoader;
				}
				return internalLoader.promise();
			}

			//
			// OK, start loading!
			//

			// clean up old load data, flags, etc.
			this._resetLoadState();

			// create a new internal promise which we'll use as the actual returned "loader"
			internalLoader = this._private.loader = $.Deferred();

			// get our class-specific "data loader" Deferred
			var dataLoader = this.getLoader();
			if (!dataLoader) {
				console.warn(this+".load(): Couldn't get loader!  Proceeding with empty, resolved deferred");
				dataLoader = $.Deferred().resolveWith(this);
			}
			// remember it (so we can cancel it if necessary)
			this._private.dataLoader = dataLoader;

			// set our "isLoading" flag only if the dataLoader is currently loading
			if (dataLoader.state() === "pending") {
				this.isLoaded = false;
				this.isLoading = true;

				// call an "onLoading" routine, passing the loading promise
				//	this allows you to do custom stuff, eg, whenever we actually load.
				this.onLoading();

				// notify observers that we are actually loading
				$(this).triggerHandler("loading");
			}

			// add success handler which cleans up the load data and resolves the internalLoader.
			dataLoader.done(this._onLoadingSucceeded.bind(this));

			// if we don't care about load errors,
			//	make a fail just call our success handler WITH NO PARAMETERS
			if (this.ignoreLoadErrors) {
				dataLoader.fail(function(){this._onLoadingSucceeded()}.bind(this));
			}
			// otherwise set up our onLoadingFailed handler
			else {
				dataLoader.fail(this._onLoadingFailed.bind(this));
			}

			// return the more restrictive deferred 'promise',
			//	since callers should not be able to directly cancel/etc the promise.
			var promise = internalLoader.promise();
			// tell the promise about its dataLoader, for TasksDisplay happiness
			promise.proxyFor = dataLoader;
			return promise;
		},



		// Internal method, called when loading completes successfully, BEFORE your callbacks.
		//	You should NOT call this directly!  Use this.onLoaded() instead.
		_onLoadingSucceeded : function(data) {
if (DEBUG_LOAD) console.debug(this+"._onLoadingSucceeded(",arguments,")");
			// remember when load succeeded, for caching
			this._private.loadTime = Date.now();

			// cancel pending load if necessary
			this.cancelPendingLoad();

			// clear flags
			this.isLoading = false;
			this.isLoaded = true;
			this.loadError = undefined;

			// pass the results through our `parseLoadedResults` routine and remember them.
			var results = Function.args();
			this._private.loadRawResponse = results;
			if (this.parseLoadedResults) results = this.parseLoadedResults.apply(this, arguments);
if (DEBUG_LOAD) console.debug(this+"._onLoadingSucceeded: end results: ", results);
			this._private.loadResults = results;

			// make a stubby loading promise if we don't have one
			var loader = this._private.loader;
			if (!loader || loader.state() !== "pending") {
				console.warn(this+"_onLoadingSucceeded(): ",(!loader ? "no loader!" : "loader already resolved"));
				loader = this._private.loader = $.Deferred();
			}
			// resolve the internal loader
			loader.resolveWith(this, [results]);
			this._signalLoadSuccess(results);
		},

		_signalLoadSuccess : function(results) {
			// call our onLoaded handler with the results
			// this is a good place for your internal callbacks
			if (this.onLoaded) {
				// i think this was meant to be call instead of apply, but
				// rather than possibly break everything, i'll just have
				// it do the right thing for non-arrays
				if (Array.isArray(results)) this.onLoaded.apply(this, results);
				else						this.onLoaded.call(this, results);
			}

			// notify observers that our loading has completed
			$(this).triggerHandler("loaded", results);

			// restart our autoReloadTimer if necessary
			this._startAutoReloadTimer();
		},

		// Internal method, called when our data loader completes successfully, BEFORE your callbacks.
		//	You should NOT call this directly!
		_onLoadingFailed : function(ajaxResponse) {
//if (DEBUG_LOAD)
console.warn(this+"._onLoadingFailed(",arguments,")");
			// reject our loading promise if no-one else has done so (also sets isLoading == false)
			this.cancelPendingLoad();

			// pass arguments through our `parseLoadedResults` routine to transform to something meaningful.
			var results = Function.args();
			this._private.loadErrorRawResponse = results;
			if (this.parseLoadError) results = this.parseLoadError.apply(this, arguments);
//if (DEBUG_LOAD)
console.debug(this+"._onLoadingFailed: end results: ", results);
			this._private.loadErrorReponse = results;

			// set our errorResult to the results as a string or as an error code
			var loadError = results[0];
			// jQuery ajax response status code
			if (loadError && typeof loadError.status === "number") loadError = loadError.status;
			// make sure our loadError is truthy!
			if (!loadError) loadError = "UNKNOWN ERROR";
			this.loadError = loadError;

			var loader = this._private.loader;
			var oldResults = this._private.loadResults;

			// If we are:
			//		- good with caching
			//		- our cache has not expired, and
			//		- we have valid data from a previous load
			//	return the previous cached
			if ( this.cacheLoadResponses && oldResults && loader && loader.state() === "pending") {
if (DEBUG_LOAD) console.debug(this+"._onLoadingFailed():  our cache data is ok, so resolving() with old data");
				this.isLoaded = true;
				this._private.loader.resolveWith(this, oldResults);
				this._signalLoadSuccess(oldResults);
				return;
			}

			// no cached data to return and we've failed
			if (!loader || loader.state() !== "pending") {
				console.warn(this+"_onLoadingFailed(): ",(!loader ? "no loader!" : "loader already resolved"));
				loader = this._private.loader = $.Deferred();
			}
			loader.rejectWith(this, results);

			// call the instance "onLoadError" method -- this is a good place for your callbacks
			if (this.onLoadError) this.onLoadError.apply(this, results);

			// notify observers that we had a problem loading
			$(this).triggerHandler("loaderror", results);
		},


		// Simulate a "load" on your object without making ajax query.
		// This will transform the data through `parseLoadedResults()`, fire your `onLoaded()` handler, etc.
		//
		// For example, lets say you have a loadable dataset, which can also be saved.
		// 	Your server, on saving, might return a copy of the data to make sure you've got the latest.
		// 	You can call `resource.manuallyLoaded(<data returned from save>)` to "reload" the resource with the new data
		// 	without hitting the server again.
		//
		//	NOTE: your `data` should be the same format yielded by a "normal" load of this resource.
		//
		manuallyLoaded : function(data) {
			// If we already have a loader which has been resolved,
			//	replace it with an unresolved one.  This is not necessarily an error!
			if (this._private.loader && this._private.loader.state() !== "pending") {
//				console.debug(this,".manuallyLoaded(): replacing previously resolved loader");
				this._private.loader = $.Deferred();
			}
			return this._onLoadingSucceeded(data);
		},

		// Reload our data, whether we think our cache is good or not.
		// If you pass properties, we'll completely unload the old data.
		// If not, and `cacheLoadResponses` is true, the cache is still valid and a second reload fails,
		//		 we'll silently pretend that the load resolve()d with the last valid set of data.
		//
		// NOTE: use `forceReload(properties)` if you ALWAYS want to unload before reloading.
		reload : function(properties) {
			// if we can cache responses and they didn't pass paramters to change
			if (this.cacheLoadResponses && !properties) {
				// just reset load state, which will allow cached data to be used
				//	if the reload fails
				this._resetLoadState();
			}
			// otherwise
			else {
				// do a full unload, which nukes all cached data
				this.unload();
				if (properties) this.extend(properties);
			}
			return this.load();
		},

		// Reload our data with some different properties:
		//		- unload()s
		//		- extend()s this object with the properties passed in,
		//		- then reloads
		//
		// NOTE: Unlike `reload()`, which will attempt to preserve your data if the second load fails,
		//		 this will ALWAYS clear your data.
		forceReload : function(properties) {
			if (this.isLoaded) this.unload();
			if (properties) this.extend(properties);
			return this.load();
		},

		// "Unload" the data, eg: we're done with it, so free it up,
		//	or our cache has expired and so the data is no longer valid and we're loading again.
		//
		//	Rejects any pending loader promise.
		//	Calls this.onUnloaded() for your subclass to do anything it cares to.
		//	Triggers "unloaded" on the object to let any observers know.
		unload : function() {
			// special case if we're Saveable:
			//	cancel any pending save operation since our data is no longer valid
			if (this.cancelPendingSave) this.cancelPendingSave();

			// if we have data from a previous load, we'll pass it to `onUnloaded()`
			var oldResults = this._private.loadResults;

			// reset our load state
			this._resetLoadState();

			// actually clear our loaded data
			this._clearLoadedData();

			// call our onUnloaded handler to release memory, etc
			if (this.onUnloaded) this.onUnloaded.apply(this, oldResults);

			// notify observers that we've unloaded, passing the old results
			$(this).triggerHandler("unloaded",  oldResults);
		},


		// If we're curently loading, reject the load with the specified `message`.
		// If we're not currently loading, this is a no-op.
		//
		// If you pass a message, we'll call our `onLoadCancelled(message)` routine,
		//	and trigger `loadCancelled(message)`.
		//
		cancelPendingLoad : function(message) {
			this.isLoading = false;
			var dataLoader = this._private.dataLoader;
			if (!dataLoader) return;
			if (dataLoader.state() === "pending" && dataLoader.rejectWith) {
				if (!message) message = "Loading cancelled";
				// fire the cancel message
				if (this.onLoadCancelled) this.onLoadCancelled(message);
				$(this).triggerHandler("loadCancelled", [message]);
				// then reject the dataLoader, which will trigger onLoadError()
				dataLoader.cancelled = true;
				dataLoader.rejectWith(this, [message]);
			}
			delete this._private.dataLoader;
		},

		// Clear reload state (makes things look like we've never loaded).
		// Cancels any pending load as well.
		_resetLoadState : function() {
if (DEBUG_LOAD) console.debug(this,".resetLoadState()");
			// cancel current load
			this.cancelPendingLoad();
			// clear state
			this.isLoaded = this.isLoading = false;
			this.loadError = undefined;
			delete this._private.loadErrorRawResponse;
			delete this._private.loadErrorReponse;
		},

		// Clear data from our last load.
		// NOTE: don't override this, override `onUnloaded()` instead.
		_clearLoadedData : function() {
if (DEBUG_LOAD) console.debug(this,".clearLoadedData()");
			delete this._private.loadResults;
			delete this._private.loadRawResponse;
			delete this._private.loadTime;
			// reject our loader if necessary
			if (this._private.loader && this._private.loader.state() === "pending") {
				this._private.loader.rejectWith(this);
			}
			delete this._private.loader;
			// reject our dataLoader if necessary
			if (this._private.dataLoader && this._private.dataLoader.state() === "pending") {
				this._private.dataLoader.rejectWith(this);
			}
			delete this._private.dataLoader;
		},


	//
	//	auto-reload semantics
	//
		// Set up an timer to reload us if our `autoReloadDuration` is non-zero.
		// Automatically called `onLoadingSucceeded()`.
		_startAutoReloadTimer : function() {
			this._clearAutoReloadTimer();
			if (this.autoReloadDelay > -1) {
				this._private.autoReloadTimer = setTimeout(this.bind("reload"), this.autoReloadDelay * 1000);
			}
		},

		_clearAutoReloadTimer : function() {
			clearTimeout(this._private.autoReloadTimer);
			delete this._private.autoReloadTimer;
		},


	//
	//	utility methods
	//

		// Do we have valid cached data that we can (re-use) on load?
		// If not, we'll clear as much data as we need to to make the next load() happy.
		_clearLoadCacheIfNecessary : function() {
			// if we're currently loading, return true as we'll have valid cached data "soon"
			if (this.isLoading) return true;

			var now = Date.now();
			var lastLoadTime = this._private.loadTime || 0;
			var cacheLoadDuration = this.cacheLoadDuration * 1000;	// convert from seconds to millis
			var cacheExpireTime = (cacheLoadDuration < 0 ? Number.MAX_VALUE : lastLoadTime + cacheLoadDuration);

			var cacheIsValid = this.isLoaded && this.cacheLoadResponses && (cacheExpireTime > now);
			if (!cacheIsValid && this.isLoaded) this.unload();
			return cacheIsValid;
		},

		// Return a loader for a specified `url` and `dataType` via jquery.ajax().
		// You can pass any `extraSettings` you like which will be put into the jQuery ajax settings.
		// If you don't pass a url, we'll just return a pre-resolved promise.
		//
		// NOTE: This implementation is jQuery specific!
		// NOTE: By default we'll tell jQuery to NOT CACHE the results (asking the server each time).
		//		 If you DO want to use the browser cache if possible, pass `extraSettings = {cache:true}`.
		//
		_getLoaderForUrl : function(url, dataType, extraSettings) {
			// if no valid url, just return an immediately resolved promise
			if (!url) return (new $.Deferred()).resolveWith(this, null);

			url = Module.expandUrl(this.urlToLoad, this);
			var settings = {
				context : this,
				cache	: false		// assume we ALWAYS want to defeat browser caching
			};
			// only add the dataType if it was specified
			if (dataType) settings.dataType = dataType;
			// stick any extraSettings in there as well
			if (extraSettings) $.extend(settings, extraSettings);
			// have jQuery do it's thing!
			return $.ajax(url, settings);
		},

	});	// end new Mixin("Loadable")

	return Mixin.Loadable;
});	// end define("oak/lib/core/Mixin")

