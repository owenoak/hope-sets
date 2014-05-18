/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Mixin to make a widget or its items sortable via the jquery.UI "sortable" interface.
//
//	You can mix this in right before you create an object like so:
//			Mixin.mixinTo(MyClass, "Sortable");
//			var mySortableThing = new MyClass({});
//
//
//	**NOTE:  Implicit dependence on jQuery-UI, which should be included in your main `.html` file.**
//
Module.define("oak/lib/ui/Sortable",
["oak/lib/core/Mixin"],
function(Mixin) {

	var Sortable = new Mixin("Sortable", {
		// Are we all ready to sort?
		// Set to `true` before `init()` to make us sortable automatically when shown.
		// Otherwise, you'll have to call `widget.enableSort()` manually, after which this will be true.
		isSortable : false,

		// Custom sortable options, see http://api.jqueryui.com/sortable.
		// 	Set this in your instance before calling initSort().
		//	NOTE: setting dragOptions on your instance will override/augment these, rather than replace them.
		sortOptions : new Property.ProtoMap("sortOptions", {
			// append the "helper" to the body while sorting
			appendTo : "body",

			// stay within the window
			containment : "window",

			// minimum move distance before sort starts
			distance : 5,

			// Set to true to debug sorting on this object.
			debug : false,

			// use the original element as the 'helper' which is actually moved.
			helper : "original",

			// sub-selector from our root for items which should be sortable
			// Default is all direct children of our root.
			items : "> *",

			// auto-scroll at the edge while sorting?
			scroll : true,

			// size of scroll edge (only if scroll is true)
			scrollSensitivity : 100,

			// speed of scroll when at edge (only if scroll is true)
			scrollSpeed : 100,

			// uset the arrow cursor
			cursor : "default",

			// test for sort when mouse pointer overlaps other items
			tolerance : "intersect"

		}),

		// Add a 'showPlugin' to call initSort() automatically when shown.
		onShownPlugins : [function(){if (this.isSortable) this.initSort()}],


		// Given an item, return its current 'sortIndex' for sorting.
		getSortIndexForItem : function(sortOptions, item) {
			return this.$root.find(sortOptions.items).index(item);
		},

		// Turn sorting on.
		// Will initialize sorting if necessary.
		enableSort : function() {
			if (!this.__sortInitialized) this.initSort();
			this.$root.sortable("enable");
		},

		// Turn sorting off.
		disableSort : function() {
			if (!this.__sortInitialized) return;
			this.$root.sortable("disable");
		},

		// Initialize sorting for this widget.
		// Note: you should call this each time the grid is updated with new elements.
		initSort : function() {
			// one-time setup of methods and options
			if (this.__sortInitialized) return this;

			// note that we're now sortable
			this.isSortable = true;

			// get normalized sort options.
			var sortOptions = this.sortOptions;

			// intercept sortXXX functions from jquery.UI.sortable to think in terms of our items
			var thisWidget = this;

			// Sorting started.
			sortOptions.start = function(event, sortInfo) {
				if (sortOptions.debug) console.warn("sortable.start(",arguments,") for ",thisWidget, " item:", sortInfo.item);

				// add extra params to the sortInfo object
				// see `onSortStarted()` for what the following mean
				Sortable.sortOwner = sortInfo.sortOwner = thisWidget;
				Sortable.startIndex = sortInfo.startIndex = thisWidget.getSortIndexForItem(sortOptions, sortInfo.item);
				// fire a global "sortStarted" message
				$(window).trigger("sortStarted");

				return thisWidget.onSortStarted(event, sortInfo);
			};

			// Called as sorting progresses.
			sortOptions.sort = function(event, sortInfo) {
				if (sortOptions.debug) console.info("sortable.sort(",arguments,") for ",thisWidget);
				// add extra params to the sortInfo object
				// see `onSorted()` for what the following mean
				sortInfo.sortOwner = Sortable.sortOwner;
				sortInfo.startIndex = Sortable.startIndex;
				sortInfo.currentIndex = Sortable.currentIndex = thisWidget.getSortIndexForItem(sortOptions, sortInfo.item);
				return thisWidget.onSorted(event, sortInfo);
			};

			// A sort was 'received' by another sortable, set up via the "connectWith" option.
			// NOTE: this fires BEFORE stop!
			sortOptions.receive = function(event, sortInfo) {
				if (sortOptions.debug) console.info("sortable.stop(",arguments,") for ",thisWidget);

				// add extra params to the sortInfo object
				// see `onSortReceived()` for what the following mean
				sortInfo.sortOwner = Sortable.sortOwner;
				sortInfo.startIndex = Sortable.startIndex;
				sortInfo.sortReceiver = Sortable.sortReceiver = thisWidget;
				Sortable.stopIndex = sortInfo.stopIndex = thisWidget.getSortIndexForItem(sortOptions, sortInfo.item);

				return thisWidget.onSortReceived(event, sortInfo);
			}

			// Sorting stopped
			sortOptions.stop = function(event, sortInfo) {
				if (sortOptions.debug) console.info("sortable.stop(",arguments,") for ",thisWidget);

				// add extra params to the sortInfo object
				// see `onSortSopped()` for what the following mean
				sortInfo.sortOwner = Sortable.sortOwner;
				sortInfo.sortReceiver = Sortable.sortReceiver;
				sortInfo.startIndex = Sortable.startIndex;
				sortInfo.stopIndex  = Sortable.stopIndex = thisWidget.getSortIndexForItem(sortOptions, sortInfo.item);

				var returnValue = thisWidget.onSortStopped(event, sortInfo);

				// fire a global "sortStopped" message
				$(window).trigger("sortStopped");

				// clean up
				delete Sortable.sortOwner;
				delete Sortable.sortReceiver;
				delete Sortable.startIndex;
				delete Sortable.currentIndex;
				delete Sortable.stopIndex;

				return returnValue;
			};


			// make the root sortable!
			thisWidget.$root.sortable(sortOptions);
			if (sortOptions.debug) console.warn("made ",thisWidget,".$root sortable: ", thisWidget.$root);

			// don't do the one-time-setup stuff again
			this.__sortInitialized = true;

			return this;
		},

	//
	//	event handling
	//
		// Sorting started from our widget.
		// 	- `sortInfo.sortOwner` is the widget who started the sort (us).
		// 	- `sortInfo.startIndex` is the index in the sortOwner which was originally dragged.
		onSortStarted : function(event, sortInfo) {},

		// Mouse was moved while sorting.
		// 	- `sortInfo.sortOwner` is the widget who started the sort (us).
		// 	- `sortInfo.startIndex` is the index in the sortOwner which was originally dragged.
		// 	- `sortInfo.currentIndex` is the index in the receiver where the element is currently.
		onSorted : function(event, sortInfo) {},

		// Sorting was 'received' in this object FROM ANOTHER WIDGET.
		// NOTE: this fires BEFORE `onSortStopped()`!
		// 	- `sortInfo.sortOwner` is the widget who started the sort (us).
		// 	- `sortInfo.startIndex` is the index in the sortOwner which was originally dragged.
		// 	- `sortInfo.sortReceiver` is the widget who received the sort.
		// 	- `sortInfo.stopIndex` is the index in the receiver where the element should go.
		onSortReceived : function(event, sortInfo) {},

		// Sorting stopped on this widget, after starting in this widget.  (See `onSortReceived()`.)
		// 	- `sortInfo.sortOwner` is the widget who started the sort (us).
		// 	- `sortInfo.sortReceiver` is the widget who received the sort (if it wasn't us.  If it is us, this will be undefinded).
		// 	- `sortInfo.startIndex` is the index in the sortOwner which was originally dragged.
		// 	- `sortInfo.stopIndex` is the index in the sortOwner where the element ended up.
		onSortStopped : function(event, sortInfo) {},

	});	// end new Mixin()

	return Mixin.Sortable;
});
