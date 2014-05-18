/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Abstract class to add generic paging functionality to a widget.
//
//	Triggers:
//		- switchingPages(newPageNumber, previousPageNumber)		// when paging animation starts
//		- showingPage(pageNumber)								// when finished showing a page
//
//	NOTE: you must use a concrete subclass (eg: PageScroller)
//			or implement a number of methods yourself.
//
//	NOTE: this is dependent on you setting your HTML up exactly right!
//

// TODO: catch swipe
// TODO: catch scroll wheel
// TODO: catch dragging (which ends up on full page boundary)
// TODO: catch window (parent?) resize via onWindowResized

Module.define("oak/lib/ui/Pageable", "oak/lib/core/Mixin", function(Mixin) {

	return new Mixin("Pageable", {
		// Page direction: horizontal or vertical.
		pageDirections : ["horizontal", "vertical"],
		pageDirection : "horizontal",

		// Page we're currently showing.
		pageNumber : 0,

		// Speed to animate switching pages, in milliseconds.
		pageSpeed : 400,

		// Should we wrap around when we go past the end or beginning?
		pageWrap : false,

		// Should we bounce if they try to go beyond the beginning or end?
		//	NOTE:  Only works if (pageWrap == false).
		pageBounce : false,

		// How fast should we bounce?
		//	NOTE:  Only works if (pageWrap == false && pageBounce == true).
		pageBounceSpeed : 100,

		// How far should we bounce, as a fraction of the page size.
		//	NOTE:  Only works if (pageWrap == false && pageBounce == true).
		pageBounceDistance : .25,

		// If true, we'll switch pages automatically.
		//	NOTE: you need to set this up in your widgets by:
		//		- onShowing() {	...	if (this.autoPage) this.startAutoPaging(); ... },
		//		- onHiding()  { ... if (this.autoPage) this.stopAutoPaging();  ... },
		autoPage : false,

		// If true, we are currently autoPaging.  See "autoPage" above.
		isAutoPaging : false,

		// Time between auto-switching of pages, in milliseconds.
		//	NOTE:  Only works after pageable.startAutoPaging().
		autoPageSpeed : 8000,

		// Set to an array of "decorator" widgets who reflects the current page that's being displayed,
		//	and/or allow you to swith pages.
		decorators : undefined,
		decoratorSetup : {
			"oak/lib/ui/Scrollbar" : {
				defaults : {
					id 			: "{{id}}Scrollbar",
					direction	: "{{pageDirection}}"
				},
				get$parent : function() {
					return (this.$footer || this.$body || this.$root);
				}
			},

			"oak/lib/ui/PagePips" : {
				defaults : {
					id 			: "{{id}}Pips",
					direction	: "{{pageDirection}}"
				},
				get$parent : function() {
					return (this.$footer || this.$body || this.$root);
				}
			},

			"oak/lib/ui/PageArrows" : {
				defaults : {
					id 			: "{{id}}Arrows",
					direction	: "{{pageDirection}}"
				},
				get$parent : function() {
					return (this.$body || this.$root);
				}
			},

			"oak/lib/ui/PageSelector" : {
				defaults : {
					id 			: "{{id}}PageSelector",
					direction	: "{{pageDirection}}"
				},
				get$parent : function() {
					return (this.$footer || this.$body || this.$root);
				}
			}
		},

	//
	//	YOUR IMPLEMENTATION MUST SET UP THE FOLLOWING!
	//

		// Return true if we're ready for paging operations to begin.
		//	You might return false if you're not drawn yet, for instance.
		isReadyToPage : function() {
			return true;
		},

		// Return the size of a specific page, in pixels.
		getSizeOfPage : function(pageNumber) {
			throw this+".getSizeOfPage("+pageNumber+"): you must implement this!";
		},

		// Return the current number of pages.  Returns 0 if we have no data.
		// NOTE: you MUST provide a getter which return this value.
		pageCount : Property.Getter(function() {
			throw this+".pageCount: you must implement this!";
		}),

		// Animate so a the current page (this.pageNumber) is visible.
		//	`direction` is "next" or "prev".
		//  `startPage` is the index of the current page.
		//	Returns a promise you can use to do something when animation completes.
		// Default implementation assumes no animation and just returns an empty promise.
		_animateToCurrentPage : function(direction, startPage) {
			return (new $.Deferred()).resolveWith(this);
		},

		// Bounce in the given direction ("start" or "end").
		//	Returns a promise you can use to do something when animation completes.
		_bouncePage : function(direction, delta, speed) {
			throw this+"._bouncePage('"+direction+"'): you must implement this!";
		},

		// Update the display for our current pageNumber.
		_updateContentsForCurrentPage : function(newPage, startPage) {
			throw this+"._updateContentsForCurrentPage(): you must implement this!";
		},

	// END IMPLEMENTATION SPECIFIC

	//
	//	switch pages
	//

		// Show an arbitrary page, specified by page number.
		// Returns a promise you can use to do something when we've finished animating/updating.
		showPage : function(pageNumber) {
			// If we're not ready to do paging yet, defer!
			if (!this.isReadyToPage()) {
	console.warn(this,".showPage(",pageNumber,"): not ready to page, deferring");
				return this.soon("showPage", .1, arguments);
			}
			// eat other deferred calls to this routine
			this.clearSoon("showPage");

			// promise which we'll return after animating/updating.
			var promise;

			// "direction" of animation from the current page to the new page
			//	one of null (no change), "next" or "prev"
			var direction;

			// we may want to "bounce" because we're trying to go past the end or before the start.
			// if so, "bounce" will be "start" or "end".
			var bounce;

			// page we are currently showing, before the change
			var startPage = this.pageNumber;

			// if there are no pages to show, just clear and bail with an empty promise.
			var pageCount = this.pageCount;
			if (pageCount > 0) {
				// Update our page number and figure out direction/bounce semantics.
				if (pageNumber == null) pageNumber = startPage || 0;
				pageNumber = this._normalizePageNumber(pageNumber);
				if (pageNumber == "start") {
					bounce = "start";
					pageNumber = 0;
				} else if (pageNumber === "end") {
					bounce = "end";
					pageNumber = pageCount - 1;
				}
				// if we're actually switching pages, update the page number
				if (pageNumber != this.pageNumber) {
					// and figure out if we should do a "next" or "prev" animation
					direction = (pageNumber > this.pageNumber ? "next" : "prev");
					// NOTE: direction animation trumps bouncing, so clear bounce
					bounce = null;
				}
				this.pageNumber = pageNumber;
			}

//console.info("showing page ", this.pageNumber);

			// If we should animate the transition, do that (which returns a promise).
			var promise;
			if (this.pageNumber != startPage) {
				$(this).triggerHandler("switchingPages", [this.pageNumber, startPage]);
			}
			if (direction) {
				promise = this._animateToCurrentPage(direction, startPage);
			}
			// otherwise if we're supposed to bounce, do that (which returns a promise)
			else if (this.pageBounce && bounce) {
				var delta = this.pageBounceDistance;
				if (bounce === "start") delta = -delta;
				promise = this._bouncePage(bounce, delta, this.pageBounceSpeed);
			}

			// if we didn't get one from the above, make a pre-resolved promise if we didn't get one from animating
			if (!promise) {
				promise = (new $.Deferred()).resolveWith(this);
			}

			// fire our finishing code when done.
			promise.done(this._finishedSwitchingPages.bind(this, this.pageNumber, startPage));

			this.updateDecorators();

			return promise;
		},

		// Callback when we're done switching pages
		_finishedSwitchingPages : function(newPageNum, startPageNum) {
//console.warn("_finishedSwitchingPages");
			this._updateContentsForCurrentPage(newPageNum, startPageNum);
			$(this).triggerHandler("showingPage", [this.pageNumber]);
			// if that was triggered manually, we don't want the interval to fire soon.
			if (this.isAutoPaging) {
				this.stopAutoPaging();
				this.startAutoPaging();
			}
		},

		// Show the first page
		showFirstPage : function() {
			return this.showPage(0);
		},

		// Show the previous page
		showPrevPage : function() {
			return this.showPage(this.pageNumber-1);
		},

		// Show the next page
		showNextPage : function() {
			return this.showPage(this.pageNumber+1);
		},

		// Show the last page
		showLastPage : function() {
			return this.showPage(this.pageCount-1);
		},


	//
	//	autoPage animation for switching between pages automatically
	//
		// Start our animation.
		startAutoPaging : function() {
			// console.info("startTimer", this.$container);
			this.isAutoPaging = true;
			if (this._pageInterval === undefined) {
				this._pageInterval = setInterval(this.bind("showNextPage"), this.autoPageSpeed);
			}
			return this;
		},

		// Stop our animation.
		stopAutoPaging : function() {
			if (this.isAutoPaging) {
				// console.info("stop", this.$container);
				clearInterval(this._pageInterval);
				delete this._pageInterval;
				this.isAutoPaging = false;
			}
			return this;
		},

	//
	// utility
	//
		// Return the total size of all pages up to (but not including) the specified page.
		getSizeOfPages : function(startPage, endPage) {
			var size = 0;
			while (startPage < endPage) {
				size += this.getSizeOfPage(startPage);
				startPage++;
			}
			return size;
		},

		// Given a pageNumber, normalize it to be within range.
		// Always returns a number, unless we're "bouncing",
		//		when it might return "start" or "end" if we're out of range.
		_normalizePageNumber : function(pageNumber) {
			if (isNaN(pageNumber)) pageNumber = 0;
			var pageCount = this.pageCount;

			// if wrapping and out of range,  wrap around to the beginning or end
			if (this.pageWrap) {
				if (pageNumber < 0) 			return pageCount - 1;
				if (pageNumber >= pageCount)	return 0;
			}
			// if bouncing and are out of range, return the bounce direction
			else if (this.pageBounce) {
				if (pageNumber < 0)				return "start";
				if (pageNumber >= pageCount)	return "end";
			}
			// otherwise just pin to the start/end page
			if (pageNumber < 0)					return 0;
			if (pageNumber >= pageCount)		return (pageCount - 1);
			return pageNumber;
		},


	});	// end new Mixin()

});	// end define("oak/lib/ui/Pageable")
