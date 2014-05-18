/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Loadable "Collection" datatype.
//
//	We assume that `collection.data` is the set of data we're managing.
//

Module.define("oak/lib/core/Collection",
"oak/lib/core/Class,oak/lib/core/Mixin,oak/lib/core/Debuggable,oak/lib/core/Loadable,oak/lib/core/Bindable",
function(Class, Mixin, Debuggable, Loadable, Bindable) {

	// Generic abstract Collection which doesn't actually do any loading.
	var Collection = new Class("Collection",
		// instance properties
		{
			mixins : "Debuggable,Loadable,Bindable",

			init : function() {
// TODO: consider using the pattern from JSONCollection instead...
				this.asThing("init");
				if (!this.data) this.initData();
			},

		//
		//	data semantics
		//

			// The "data" for our collection.
			// You'll generally update this in `updateData()`, which is called automatically `onDataChanged`.
			// `initData()` (called automatically as appropriate) should initialize to empty data.
			data : undefined,

// NOTE: syntactic sugar so we match the old Dataset API.
// TODO:  remove this soon!
			getData : function() {
				if (!this.data) this.initData();
				return this.data;
			},

			// Initialize clean containers for our data and return the main `data` object.
			// At the very least you should set `this.data` to an instance of some data container.
			// By default we create an Array, override to do something more exotic.
			initData : function() {
				this.data = new Array();
				return this.data;
			},

			// Update our data object.  Called automatically onDataChanged.
			//	Default does nothing, you'll very likely need to override this.
//TODO: this semantic is wierd... Not clear why/how/when we'd want to do this.
			updateData : function() {},


			// Call this when the data changes.
			//	It broadcasts the "changed" event, so observers can redraw.
			//	If you need to calculate something based on the new data, this is a good time to do it.
			onDataChanged : function() {
				this.clearSoon("onDataChanged");
				this.updateData();
				$(this).trigger("changed");
			},


		//
		//	loading semantics
		//

			// Url to load.  Will be munged via Module.expandUrl() to get any dynamic parameters, etc.
			// If empty, we'll just return an empty promise rather than actually attempting to load anything.
			urlToLoad : "",

			// Parse the data that was loaded.
			// You MUST override this for your specific data type.
			parseLoadedResults : function() {
				return [this];
			},

			// When we've finished loading, signal a "changed" event.
			onLoaded : function() {
				// NOTE: Loadable will already signal "loaded".
				this.soon("onDataChanged");
			},

			// When load error, signal a "changed" event.
			onLoadError : function() {
				// NOTE: Loadable will already signal "loaderror".
				this.soon("onDataChanged");
			},

			// When we're unloaded, clear our data
			onUnloaded : function() {
				// NOTE: Loadable will already signal "unloaded".
				this.initData();
				this.soon("onDataChanged");
			}

		},

		// class properties
		{}
	);	// end new Class("Collection")

	//
	// PagedCollection
	//		List-like collection which divides its data into a number of "pages"
	//		which are loaded individually  (see:  `loadPage()`).
	//
	//	NOTE: When loading a particular page, we currently drop items outside that page.
	//			This may change in the future.
	//
	//	NOTE: it's up to you to set `pageCount` in your `onLoaded()` routine,
	//			and to pass the appropriate `pageNumber` and `pageSize` in your `urlToLoad`.
	//
	new Class("PagedCollection", Collection,
		// instance properties
		{
			// Current page we're showing.
			//	NOTE: setting this has no direct effect, you should use `loadPage()` instead.
			pageNumber : 0,

			// Number of items in each page  (defaults to 100 items)
			//	NOTE: setting this has no direct effect, you should use `loadPage()` instead.
			pageSize : 100,

			// Number of pages of data.  Returns 0 if we're not loaded.
			//	NOTE: setting this is a bad idea, we'll automatically set it `onLoaded()`.
			pageCount : 0,


		//
		//	loading semantics
		//

			// Load a particular page.
			loadPage : function(pageNumber) {
				this.pageNumber = this.normalizePageNumber(pageNumber);

				// clean up load state
				// if we've got a loader, tell it to stop
				this.cancelPendingLoad();

				// unload our data (so collections will see a change)
				// but DO NOT reset pageNumber or pageCount
				this.asCollection("unload");

				// and call load() as normal
				this.load();
			},


			// Reload the current page.
			reloadPage : function() {
				this.loadPage(this.pageNumber);
			},


			// On unload, reset our pageCount and pageNumber.
			unload : function() {
				this.asCollection("unload");
				this.pageNumber = 0;
				this.pageCount = 0;
			},




		//
		// utilities
		//

			// Given a page number, normalize it to be within range.
			// NOTE: if we're not loaded (eg: our pageCount is undefined), this will just return the number.
			normalizePageNumber : function(pageNumber) {
				if (this.pageCount == 0) return 0;
				if (pageNumber < 0) return 0;
				if (pageNumber >= this.pageCount) return this.pageCount - 1;
				return pageNumber;
			}
		},

		// class properties
		{}

	);	// end new Class("PagedCollection")


	// Collection which "wraps" a loadable `source` data object to make it (or some part of it) appear like a Collection.
	//
	// We get data from the `source` object via the `updateData()` routine.
	//	The default is that we'll just return the `source` object directly;
	//	you'll often want to override this to return a particular property of the source.
	//
	// Instead of acutally loading ourself, we'll ask our `source` to load and use it's loadingPromise to load us.
	//	We'll also watch "load", "loadError" and "changed" events on the source,
	//	which will cause us to update our data and fire our "changed" event.
	//
	var WrappedCollection = new Mixin("WrappedCollection", {

		// Return the data from the source.
		// NOTE: This may be called with the source in any state -- null, loaded, loadError, unloaded, etc.
		// NOTE: you will generally override this in your instance class!
		updateData : function() {
			this.data = this.source;
		},

		// Get/set the source object which we derive from.
		// NOTE: you MUST set this in your instance (or class if your source is a singleton).
		source : Property.WatchedObject("source", {
			getWatchEvents : function() {
				return { 	"changed" 	: this.bindSoon("onDataChanged"),
							"loaded"	: this.bindSoon("onDataChanged"),
							"loadError"	: this.bindSoon("onDataChanged") }
			},
			onChange : function() {
				this.soon("onDataChanged");
			}
		}),

	//
	//	loading
	//
		// When we're told to load, defer to our source object's load if it can load.
		// If it's not loadable, we just return an empty promise which is immediately resolved.
		getLoader : function() {
			var promise;
			if (this.source && this.source.isLoadable) {
				promise = this.source.load();
			} else {
				promise = (new $.Deferred()).resolveWith(this);
			}
			// tell the promise to fire our onDataChanged() event when loading finishes.
			// this will fire immediately if our source is already loaded, or if it's not loadable at all.
			promise.done(this.bind("onDataChanged"));

			return promise;
		},

		isLoaded : Property.Getter(function(){return this.source.isLoaded}),
		isLoadError : Property.Getter(function(){return this.source.isLoadError}),
		isLoading : Property.Getter(function(){return this.source.isLoading}),

	});


	// Collection which loads data from an XML data request.
	//
	// Implement `getLoader()` routine to fetch the data,
	//	and override `onLoaded($response)` to return the data massaged however you want it.
	//
	var XMLCollection = new Mixin("XMLCollection", {
		dataType : "oxml",

		parseLoadedResults : function($response) {
			if (Collection.debug) console.warn(this,".parseLoadedResults(",$response,"): You MUST override .onLoaded() to process the XML response and set this.data");
			this.asCollection("parseLoadedResults");
			return [$response];
		},

		onLoadError : function(self, xhrRequest) {
			if (Collection.debug) console.warn(this,".onLoadError(): You probably MUST override .onLoadError() to process this error response:\n", xhrRequest);
			this.asCollection("onLoadError");
		}
	});


	return Collection;

});
