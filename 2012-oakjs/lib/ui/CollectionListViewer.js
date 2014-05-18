/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Generic viewer for list-like collection (array, IndexedList, etc).
//	You MAY get away with not subclassing this if you're not doing anything fancy.
//

Module.define("oak/lib/ui/CollectionListViewer",
"oak/lib/ui/CollectionViewer",
function(CollectionViewer) {

	new Class("CollectionListViewer", CollectionViewer,
	// instance properties
	{
		// set to true to debug showing more items on scroll
		debugScroll : false,

		// set to true to debug double clicking
		debugClick : false,

		// Template HTML for drawing an item from the dataset.
		//	Will be evaluated with  {viewer:this, item:<item>, index:<item index>}
		// You'll likely want to override this.
		itemTemplate : "<div class='item' index='{{index}}'>{{item}}</div>",

		parts : {
			// Live selector for our item elements.
			// You'll likely want to override this. Don't forget the "LIVE:## " bit.
			$items : "LIVE:## .item",

			// Set to some selector (eg:  "$footerMessage") to show # of results message
			$resultCounter : "",

		},

		// see `updateContents()`
		singleResultCountMessage : "{{count}} item",
		multiResultCountMessage : "{{count}} items",

		// When one of our selected items is clicked, call our `onItemClicked` method.
		events : [
			{selector:"## .closer", event:"click", handler:"onCloserClicked"},
			{selector:"$items", event:"click", handler:"onItemClicked" },
			{selector:"## .Marker.moreMarker", event:"click", handler:"showNextBatchOfItems" },
		],

		// Set to `true` to get "onItemDoubleClicked" calls when a double-click occurs on an item.
		watchForDoubleClick : false,

		// When "watchForDoubleClick" is `true`, set this to `true` to prevent the "select" call until
		// the double click interval expires.  This will slow down "select" calls after a single click.
		preventSelectAndDoubleClick : false,

		// time interval in ms in which two clicks is counted as a double click
		doubleClickInterval : 500,

		// Shortcut to our 'items', the data from our collection.
		//	NOTE: may be undefined!
		//	NOTE: it's a bad idea to mutate this indiscriminately!
		items : Property.Getter(function(){return this.collection ? this.collection.data : undefined;}),

		// Item which was selected by the user.
		// NOTE: changing this (currently) has no effect.
// TODO: make this live action!
		selectedItem : undefined,

		// If true, we mark the selected item by putting a 'selected' class on it.
		//	This allows you to do CSS styling when the item is selected.
		//	See `markSelectedItem()`.  See `selectedClass`.
		markSelection : false,

		// CSS class name to add to an item when it's selected.
		selectedClass	: "selected",

		// Maximum number of items to show at once.
		// Set to 0 to show ALL items (which can be expensive for large lists).
		maximumToShow : 0,

		// Start index of what we're showing.
		// Only applies if `maximumToShow > 0`.
		startIndex : 0,

		// End index of what we're showing (NOT inclusive).
		// Only applies if `maximumToShow > 0`.
		endIndex : 0,

		// Last known scrollTop, for resetting scroll
		scrollTop : undefined,

		// If true, we attempt to restore scroll after a redraw.
		retainScroll : false,

		// Template HTML to append to the body if there's more to be loaded.
		// Only used if `maximumToShow > 0` and we actually have more to show.
		moreMarkerTemplate : "<div class='Marker moreMarker'></div>",

		// Template HTML to append to the body if there's more to be loaded.
		// Only used if `maximumToShow > 0` and we actually showed more than would fit in the list at one point.
		endMarkerTemplate : "<div class='Marker endMarker'></div>",


		// When our collection changes, reset our `startIndex` and `endIndex` BEFORE redrawing
		//	so we start drawing at the top again.
		onCollectionChanged : function() {
			// reset scroll
			this.scrollTop = undefined;

			// reset our start/end index to start drawing from the top again
			if (this.maximumToShow) {
				if (this.debugScroll) console.info(this+".onCollectionChanged():  resetting start/end index");
				this.startIndex = this.endIndex = 0;
			}
			this.asCollectionViewer("onCollectionChanged");
		},


		bodyScrollDelay : .1,
		onReady : function() {
			this.asCollectionViewer("onReady");

			// Manually intercept the 'scroll' event of our body element to call our `onBodyScrolled` routine.
			//	Do it on a short delay so we don't fire too often
			this.$body.on("scroll", function(event){this.soon("onBodyScrolled", this.bodyScrollDelay)}.bind(this));
		},

		// Return the list of items to be shown right now.
		// By default, this is our full list of items.
		// You might, eg, want to sub-set it if you only want to show certain types of items, etc.
		getItemsToShow : function() {
			return this.items;
		},

		// Draw the grid of items for the loaded dataset.
		updateHTML : function() {
			if (this.debugScroll) console.info(this+".updateHTML()  endIndex:",this.endIndex);
			var items = this.getItemsToShow();
			// NOTE: make sure endIndex is set  -- gets reset to 0 if onCollectionChanged() is called.
			if (this.endIndex === 0) {
				this.endIndex = this.startIndex + this.maximumToShow;
			}
			// don't go off the end
			if (this.endIndex < items.length) this.endIndex = items.length;
			if (this.debugScroll) console.warn(this.id,"updateHTML: item count: ",items.length," startIndex: ",this.startIndex,"  endIndex: ",this.endIndex);

			var paging = (this.maximumToShow > 0) && (items.length > this.endIndex);
			if (paging) {
				items = items.slice(this.startIndex, this.endIndex);
				if (this.debugScroll) console.warn("Subsetting list from ",this.startIndex, " to ", this.endIndex);
				if (this.moreMarkerTemplate) this.$moreMarker = $(this.moreMarkerTemplate.expand(this));
			}

			var	html = this.getHTMLForItems(items);
			this.$body.html(html);

			if (paging && this.$moreMarker) {
				this.$body.append(this.$moreMarker);
			}

			if (this.scrollTop !== undefined && this.retainScroll) {
				setTimeout(function() {
					this.$body.scrollTop(this.scrollTop);
				}.bind(this), 0);
			}

			this.asCollectionViewer("updateHTML");
		},

		// After updating contents, make sure we show the selection in a little while.
		updateContents : function() {
			this.asCollectionViewer("updateContents");
			this.soon("markSelectedItem");
		},

		// When our body element scrolls, see if we should show additional items based on our `maximumToShow`.
		bottomScrollDelta : 100,
		onBodyScrolled : function() {
			this.clearSoon("onBodyScrolled");
			var scrollTop = this.scrollTop = this.$body.scrollTop();

			if (this._justShowedNextBatch) return;

			// bail if we're not actually subsetting
			if (this.maximumToShow === 0) return;
			// if no data, forget it
			var items = this.getItemsToShow();
			if (!items || items.length === 0) return;
			// if already showing the end, forget it
			if (this.endIndex >= items.length) return;

			var adjustedBottom = this.$body.scrollTopMax() - this.bottomScrollDelta;
			var shouldShowMore = (scrollTop >= adjustedBottom);
			if (this.debugScroll) console.warn("onBodyScrolled", scrollTop, " : ", adjustedBottom, " show more? ",shouldShowMore);
			if (shouldShowMore) {
				// show the next batch of items on a short delay
				this.soon("showNextBatchOfItems", .2);
			}
		},

		// They've scrolled so the next bunch of items should show up.
		// Generate 'em and throw 'em in the $body!
		showNextBatchOfItems : function() {
			this.clearSoon("showNextBatchOfItems");
			// set a flag and then clear it in a little while
			//	so we don't get into an endless loop of showing batches
			this._justShowedNextBatch = true;
			setTimeout(function(){
				delete this._justShowedNextBatch;
			}.bind(this), 100);

			var last = this.endIndex;
			var itemsToShow = this.getItemsToShow();
			var items = itemsToShow.slice(last, last+this.maximumToShow);
			this.endIndex = last + items.length;

			if (this.debugScroll) console.warn("showing ", last, " to ", this.endIndex);
			var html = this.getHTMLForItems(items);

			var oldScroll = this.$body.scrollTop();

			// take the moreMarker out of the HTML before appending the additional stuff
			if (this.$moreMarker) this.$moreMarker.detach();

			// add the stuff and attempt to reset the scroll to what it was
			this.$body.append(html);
			this.$body.scrollTop(oldScroll);

			var atTheEnd = this.endIndex >= itemsToShow.length;
			if (this.$moreMarker) {
				if (atTheEnd) {
					// get rid of the more marker
					delete this.$moreMarker;
				} else {
					// move our <more> item to the end
					this.$body.append(this.$moreMarker);
				}
			}
			// add an endMarker if at the end of the list
//			if (atTheEnd) {
//				if (this.endMarkerTemplate) this.$endMarker = $(this.endMarkerTemplate.expand(this))
//				if (this.$endMarker) this.$body.append(this.$endMarker);
//			}
		},


		// Return the HTML for data items passed in (assumes dataset is loaded, etc)
		getHTMLForItems : function(items) {
			if (!items) items = this.getItemsToShow();
			if (!items) return "";

			// update the body HTML
			var html = [];
			if (!items.forEach) {
				console.warn(this,".getHTML(): items has no forEach method!");
				return "";
			}

			items.forEach(function(item, index) {
				if (item) html.push(this.getHTMLForItem(item, index));
			}, this);

			return html.join("");
		},

		// Return the HTML for one particular item in the list.
		getHTMLForItem : function(item, index) {
			if (!item) return "";
			var subs = {
				viewer : this,
				item : item,
				index : index
			};
			return this.itemTemplate.expand(subs);
		},

	//
	//	event handling
	//


		// Given an event and its corresponding element,
		//	figure out which item in our dataset we're dealing with.
		// NOTE: You'll likely want to override this.
		getItemForEvent : function(event, $item) {
			return this.getItemFor$item($item);
		},

		// Given an `$item` in our display, return the `item` in our `collection.data` that corresponds to it.
		// Returns `undefined` if no item found.
		getItemFor$item : function($item) {
			var items = this.items;
			if (!items) return undefined;
			var index = $item.attr("index");
			return items[index] || items[parseInt(index)];
		},

		// Given an `item` in our `collection.data`, return the `$item` that corresponds to it.
		// Returns an empty jQuery vector if not found.
		get$itemForItem : function(item) {
			var items = this.items;
			if (!item || !items) return $();
			var index = items.indexOf(item);
			if (index === -1) return $();
			return this.$root.find("[index='"+index+"']");
		},


		// The "closer" `<span class='closer'></span>` on one of our items was clicked.
		// You'll probably want to ask if they want to delete, and delete that item.
		onCloserClicked : function(event, $closer) {
			var item = this.getItemForEvent(event, $closer.parent());
			event.stop();
		},

		// One of our items was clicked.
		// Try to figure out which data object it corresponds to, and if we can, call `select()` with it.
		// NOTE: for this to work, you may have to change .getItemForEvent()
		onItemClicked : function(event, $item) {
			// what JS item was clicked on?
			var item = this.getItemForEvent(event, $item);
			if (this.debugClick) console.group(this+".onItemClicked(",$item,") item: ",item);
			// if we DID get a valid object, stop the event from bubbling.
			if (item) event.stopPropagation();

			// if we're not concerned with double-click, just call itemSelected immediately
			if (!this.watchForDoubleClick || !item) {
				this.select(item, $item);
				if (this.debugClick) console.info("not double-clicking, just calling select() directly");
				if (this.debugClick) console.groupEnd();
				return false;
			}

			//
			// double-click processing
			//

			// cancel any pending click timer
			clearTimeout(this._lastClickTimer);
			if (this.debugClick) console.info("clearing click timer");

			// if the last item clicked was our item, we've got a double click!
			if (this._lastClickItem == item) {
				if (this.debugClick) console.info("_lastClickItem matches -- firing double click on ",this._lastClickItem);
				clearTimeout(this._lastClickTimer);
				this.onItemDoubleClicked(item, $item);
				// clear
				delete this._lastClickItem;
				delete this._lastClick$item;
				if (this.debugClick) console.groupEnd();
				return false;
			}

			if (!this.preventSelectAndDoubleClick) {
				// select the item immediately
				this.select(item, $item);
			}
			this._lastClickItem = item;
			this._lastClick$item = $item;

			// clear the _lastClickItem etc on a timer
			if (this.debugClick) console.info("setting up timer for ",this._lastClickItem);
			this._lastClickTimer = setTimeout(function() {
				if (this.debugClick) console.warn("_lastClickTimer fired for ",this._lastClickItem);
				if (this._lastClickItem === item) {
					delete this._lastClickItem;
					delete this._lastClick$item;
					if (this.preventSelectAndDoubleClick) {
						this.select(item, $item);
					}
				}
			}.bind(this), this.doubleClickInterval);	// quarter-second double-click delay

			if (this.debugClick) console.groupEnd();
			return false;
		},

		// Called when an item is double-clicked.
		// NOTE: You MUST set "watchForDoubleClick" to true for this to work.
		//		 It will make normal clicks a little slower...
		// You can watch for the grid "itemDoubleClicked" event to do something on click.
		onItemDoubleClicked : function(item, $item) {
			if (item) $(this).trigger("itemDoubleClicked", [item, this]);
			if (this.showingModally) this.onOK();
			return item;
		},

		// Select an `item` in our list.
		// If `item` is null, or we can't find a display `$item` for it, we'll clear selection.
		select : function(item, $item) {
			var wasAlreadySelected = (item === this.selectedItem);
			if (!wasAlreadySelected) this.clearSelection();
			this.selectedItem = item;
			if (!$item) $item = this.get$itemForItem(item);
			this.markSelectedItem($item);
			if (item) $(this).trigger("itemSelected", [item, this]);
			return item;
		},

		// Clear the current selection.
		clearSelection : function() {
			if (this.selectedItem) $(this).trigger("itemDeselected", [this.selectedItem, this]);
			this.selectedItem = undefined;
			this.markSelectedItem(null);
		},

		// Given a $item from the list, mark it as selected
		markSelectedItem : function($item) {
			if (!this.markSelection) return;

			// remove selection from all other objects
			var selectedClass = this.selectedClass;
			this.$body.find("."+selectedClass).removeClass(selectedClass);

			if (this.selectedItem) {
				if (!$item) $item = this.get$itemForItem(this.selectedItem);
				if ($item && $item.length) {
					// add selection to the specified object.
					$item.addClass(selectedClass);
					// and scroll it into view
					$item.scrollIntoView();
				}
			}
			if (this.$okButton) this.$okButton.toggleClass("disabled", this.selectedItem == null);
		},


		// Select the first item in the list.
		// Useful if you want to make sure something is always selected.
		selectFirst : function() {
			var item = (this.items ? this.items[0] : undefined);
			this.select(item);
		},



	//
	//	Add an updatePlugin to update our `$resultCounter` element with the # of items.
	//
		updatePlugins : [function() {
			if (!this.$resultCounter || this.$resultCounter.length == 0) return;
			this.$resultCounter.html(this.resultCountMessage);
		}],

		// Return the message to display in the result counter.
		resultCountMessage : Property.Getter(function() {
			if (this.collection && this.collection.isLoaded && this.collection.data) {
				var count = this.collection.data.length;
				if (count == 1) return this.singleResultCountMessage.expand({count:count});
				else			return this.multiResultCountMessage.expand({count:count});
			} else {
				return "";
			}
		})

	});	// end new Class("CollectionListViewer")

	return Class.CollectionListViewer;
});
