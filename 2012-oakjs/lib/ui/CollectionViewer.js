/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Generic viewer for a collection.  You MUST implementa a subclass of this to display in a particular fashion.
//	NOTE: this does not assume we've got an array or really much of anything,
//			you probably want to subclass CollectionListViewer instead of this if you're dealing with an array.
//

Module.define("oak/lib/ui/CollectionViewer",
"oak/lib/core/Class,oak/lib/ui/Panel,oak/lib/core/Property-Exotic",
function(Class, Panel, Property) {

	new Class("CollectionViewer", Panel,
	// instance properties
	{

		// set to true to print debug messages as we go through our update cycle
		debugUpdate : false,

		// Collection we display.
		// NOTE: you MUST set this in your instance (or class if your collection is a singleton).
		collection : Property.WatchedObject("collection", {
			getWatchEvents : function() {
				return {
					// load state change
					"loaded" 			: this.onDataChanged.bind(this, ["loaded"]),
					"loading" 			: this.onDataChanged.bind(this, ["loading"]),
					"loaderror" 		: this.onDataChanged.bind(this, ["loaderror"]),
					// data in the collection changed
					"changed" 			: this.onDataChanged.bind(this, ["changed"]),
					// the collection itself changed (eg: same object loading a different dataset)
					"collectionChanged" : this.onCollectionChanged.bind(this),

				};
			},
			onChange : function(newCollection, oldCollection) {
				this.onCollectionChanged();
			}
		}),

		// if true, we automatically load our collection when we're shown.
		// NOTE: this will not re-load the collection if it has already been reloaded.
		autoLoad : true,

		// if true, we auto-update our title whenever we redraw

		// Message to show when our collection is in an unloaded state.  Auto-expands with this widget.
		unloadedMessage : "",

		// Message to show while our collection is loading.  Auto-expands with this widget.
		loadingMessage : "Loading",

		// Message to show if an error loading data.  Auto-expands with this widget.
		loadErrorMessage : "Load Error",

		// Message to show if we've loaded but there's no data.  Auto-expands with this widget.
		emptyDataMessage : "Nothing to show",

		// Message to show if we don't have a collection at all.
		noCollectionMessage : "",

		// template for displaying the 'loading...' message
		messageTemplate : "<div class='WidgetMessage {{className}}'>{{message}}</div>",

		events : [],

		parts : {
			// by default we show our "loading" etc messages in the body
			// you can also create a specific element to hold messages
			//	and then override parts.$message
			$message 	: "## > .Body"
		},

		// assume that we want to scroll the body
		scrollBody : true,

		// When the collection we're looking at changes, reset some stuff and then call "onDataChanged" to redraw.
		// NOTE: if you manually change the data which has loaded (eg: to point at a different data set)
		//		 you may want to call `onCollectionChanged()` to redraw.
		onCollectionChanged : function() {
			if (this.debugUpdate) console.info(this.id, "onCollectionChanged", this.collection);
			// Set a flag to reset our scroll to the top.
			// This will be executed by an `updatePlugin`, defined below.
			this._resetScrollAfterUpdate = true;
			// then call our onDataChanged in a little bit to redraw
			this.onDataChanged("collectionChanged");
		},

		// When our data changes (eg: items are added or removed), redraw and then re-fire a "changed" event.
		onDataChanged : function(whatHappened) {
			if (this.debugUpdate) console.warn(this.id,".onDataChanged(",whatHappened,")");
			this.soon("update");
			$(this).trigger("changed");
		},

//
//	draw cycle
//

		// Tell the collection to load if it hasn't been done already and autoLoad is true.
		onShowing : function() {
			if (this.autoLoad && this.collection && !this.collection.isLoaded) this.collection.load();
		},


		// Drawing our data:
		//	- if no collection, show "empty data message"
		//	- if collection is loading, show "loading message"
		//	- if collection load error, show "load error message"
		//	- otherwise delegate to "updateHTML()" to draw actual data.
		updateContents : function() {
			this.asWidget("updateContents");
			var collection = this.collection;
			if (!collection) {
				if (this.debugUpdate) console.info(this.id,".updateContents(): no collection");
				this.showNoCollectionMessage();
			}
			// our collection is in the process of loading
			else if (collection.isLoading) {
				if (this.debugUpdate) console.info(this.id,".updateContents(): loading");
				this.showLoadingMessage();

			}
			// there was an error loading our collection
			else if (collection.loadError) {
				if (this.debugUpdate) console.info(this.id,".updateContents(): loadError");
				this.showLoadErrorMessage();

			}
			// our collection has loaded properly
			else if (collection.isLoaded) {
				var data = collection.data;
				// ... but there is no data to display
				if (!data || (data && data.isEmpty)) {
					if (this.debugUpdate) console.info(this.id,".updateContents(): data is empty");
					this.showEmptyDataMessage();
				}
				// ... or if there is, display the data!
				else {
					if (this.debugUpdate) console.info(this.id,".updateContents(): updating html");
					this.updateHTML();
				}
			}
			// collection is set up, but not yet loaded.
			else {
				if (this.debugUpdate) console.info(this.id,".updateContents(): unloaded");
				this.showUnloadedMessage();
			}
		},

		// Show a message when we don't have a collection set up.
		showNoCollectionMessage : function() {
			var message = (this.noCollectionMessage || "").expand(this);
			this.showMessage(message, "empty");
		},

		// Show a message when we're UNloaded.
		showUnloadedMessage : function() {
			var message = (this.unloadedMessage || "").expand(this) ;
			this.showMessage(message, "empty");
		},

		// Show a message when we're loading.
		showLoadingMessage : function() {
			var message = (this.loadingMessage || "").expand(this) ;
			this.showMessage(message, "loading");
		},

		// Show a message when we've had a load error.
		showLoadErrorMessage : function() {
			var message = (this.loadErrorMessage || "").expand(this) ;
			this.showMessage(message, "error");
		},

		// Show a message when we've loaded, but there's no data to show.
		showEmptyDataMessage : function() {
			var message = (this.emptyDataMessage || "").expand(this) ;
			this.showMessage(message, "empty");
		},

		// Show a message to the user wrapped in our "noticeTemplate".
		// Called automatically by updateContents() if
		showMessage : function(message, noticeClass) {
			message = this.messageTemplate.expand({
				viewer		: this,
				message 	: message,
				className	: noticeClass
			});
			this.$message.html(message).show();
		},



		// Update our HTML for a collection WHICH HAS LOADED SUCCESSFULLY.
		//	Get the data to draw from your collection.
		//	You will generally do this by setting:   this.$body.html(YOUR HTML HERE)
		//
		//	NOTE: you can assume:
		//			- that you have a valid collection, and
		//			- that it has been successfully loaded
		//			- the collection's data is not 'empty' (eg: it exists and data.isEmpty is false)
		//
		//	NOTE: you generally want to do your stuff BEFORE calling the superclass method
		//		  so that we'll reset scroll for you if necessary.
		updateHTML : function() {
			if (this._resetScrollAfterUpdate) {
				this.resetScroll();
				delete this._resetScrollAfterUpdate;
			}
		},

		// Reset our scroll to the top.
		resetScroll : function() {
			if (this.$body) this.$body.scrollTop(0);
		},

	});	// end new Class("CollectionViewer")

	return Class.CollectionViewer;
});
