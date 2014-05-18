/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Scroll a bunch of "items", focusing on each one at a time.
//	Performs a "slide" animation to show the next item.
//	We do NOT assume that all pages are the same size.
//
//	Only draws up to three items at a time:
//		- previous item
//		- current item
//		- next item
//

Module.define("oak/lib/ui/Carousel",
"oak/lib/core/Class,oak/lib/ui/Widget,oak/lib/ui/Pageable",
function(Class, Widget, Pageable) {

	// flag
	var DONT_STOP = "DONT_STOP"; // the music

	return new Class("Carousel", "Widget", {
		mixins : "Pageable",

		// Array of items we're displaying.
		items : null,

		// special transition effects. "slide" by default.
		pageEffects : ["slide","fade","stack"],
		pageEffect : "slide",

		// true if we should overlap items (fade or stack), false if we should spread them out (slide)
		shouldOverlapItems : function(){return (this.pageEffect === "fade") || (this.pageEffect === "stack")},

	//
	//	YOUR IMPLEMENTATION MUST SET UP THE FOLLOWING!
	//	If you use the widgetTemplate provided in this file you should be all set.
	//

		parts : {
			// Very large element which shows your content and moves back and forth to scroll.
			$scroller	: "## .Scroller",

			// Element which clips the $scroller.  Also used to get the size of each "page".
			//	This will often be your outer element, but it might be some nested element in some cases.
			$scrollMask	: "##",

			// Containers for each page.  We assume you have three: "prev", "current" and "next".
			$prev				: "## .PageContainer.prev",
			$current			: "## .PageContainer.current",
			$next				: "## .PageContainer.next",

			// All page containers as a group.
			$pageContainers		: "## .PageContainer",

			// Footer (holds page indicator)
			$footer				: "## .Footer"
		},

		// Generic template for drawing your widget.
		widgetTemplate : "<div id='{{id}}' class='{{constructor.id}} {{className}} ScrollMask'>"
							+ "<div class='Body Scroller'>"
								+ "<div class='PageContainer prev'></div>"
								+ "<div class='PageContainer current'></div>"
								+ "<div class='PageContainer next'></div>"
							+ "</div>"
							+ "<div class='Footer'></div>"
						+ "</div>",

	//
	// general drawing semantics
	//
		onReady : function() {
			this.$root.addClass("effect-"+this.pageEffect);
		},

		onShowing : function() {
			this.setItems(this.items, true);
		},

		onHiding : function() {
			if (this.autoPage) this.stopAutoPaging();
		},

		clearContents : function() {
			this.asWidget("clearContents");
			this.stopAutoPaging();
			this.$pageContainers.html("");
			this._scrollTo(0, 0);
		},


		// (re)set our list of items we're displaying.
		// Pass true to reset to show first item and start autoPaging
		setItems : function(items, reset) {
			this.items = items || [];
			if (this.items.length === 0) {
				this.clearContents();
			} else {
				this.updateDecorators();
				if (reset) {
					this.showFirstPage();
					if (this.autoPage) this.startAutoPaging();
				}
			}
		},

		// Remove a specific item, specified by index.
		// If you're removing several items, call .setItems() instead.
		removeItem : function(index) {
			this.items.splice(index, 1);
			this.setItems(this.items);

			// only update if we're showing the page we're deleting.
			var shouldUpdate = (index === this.pageNumber);
			//  (you can show the same page number and it will show the new item at that slot
			//	 or roll around if necessary)
			if (shouldUpdate) this.showPage(this.pageNumber);
		},


	//
	//	paging semantics
	//

		// We're ready to scroll if our $scrollMask is non-zero width.
		//	Otherwise we're not drawn yet.
		isReadyToPage : function() {
			return this._getScrollMaskSize() !== 0;
		},

		// Return the size of some page, in pixels.
		// By default, we assume that all pages are the same as the size of the $scrollMask.
		getSizeOfPage : function(pageNumber) {
			return this._getScrollMaskSize();
		},

		// Return the current number of pages, by calculating the max scroll against the page size.
		// NOTE: this assumes all pages are the same size!
		pageCount : Property.Getter(function() {
			return (this.items ? this.items.length : 0);
		}),

		// Update the display for our current pageNumber.
		// NOTE: we don't actually do anything here, assuming the content is all in place.
		_updateContentsForCurrentPage : function() {
//console.info("_updateContentsForCurrentPage", this.pageNumber);
			if (this.pageCount == 0 || this.pageNumber < 0) return this.clearContents();

			var pageSize = this._getScrollMaskSize();
			var left = 0;
			var scrollLeft = 0;

			// 3 pages we'll show
			var page = this.pageNumber;
			var prev = this._normalizePageNumber(page - 1);
			var next = this._normalizePageNumber(page + 1);

			// sizes of the three pages
			var prevSize = this.getSizeOfPage(prev);
			var pageSize = this.getSizeOfPage(page);
			var nextSize = this.getSizeOfPage(next);

			// update the current page first, so it will start loading first
			this._update$pageContainer(page, this.$current, pageSize, prevSize);

			// update the next page next to preload it
			this._update$pageContainer(next, this.$next, nextSize, prevSize + pageSize);

			// update the previous page last
			this._update$pageContainer(prev, this.$prev, prevSize, 0);

			// scroll the body over so the current page is visible
			this._scrollTo(-prevSize, 0);
		},

		// Update a certain pageContainer to show a particular page.
		_update$pageContainer : function(pageNumber, $pageContainer, containerSize, position) {
//console.info("_update$pageContainer", pageNumber, $pageContainer[0].className);
			var html = (typeof pageNumber === "number" ? this.getHTMLForItem(pageNumber) : "");
			$pageContainer.html(html);

			// set the width/height of the container
			if (containerSize != null) {
				var property = (this.pageDirection === "horizontal" ? "width" : "height");
				$pageContainer.css(property, containerSize);
			}
			if (position != null && !this.shouldOverlapItems()) {
				var property = (this.pageDirection === "horizontal" ? "left" : "top");
				$pageContainer.css(property, position);
			}
			return $pageContainer;
		},

		// Animate so the current page is visible.
		//	Returns a promise you can use to do something when animation completes.
		_animateToCurrentPage : function(direction, startPage) {
//console.info("_animateToCurrentPage", this.pageNumber);
			var speed = this.pageSpeed;

			var scrollPromise;

			// make sure the thing we're scrolling to is visible and is showing the right thing
			var $container = (direction === "prev" ? this.$prev : this.$next);
			this._update$pageContainer(this.pageNumber, $container);

			var position = (direction === "prev" ? 0 : this._getScrollMaskSize()*2);

			switch (this.pageEffect) {
				case 'fade':
					// divide the effect into two pieces
					speed = Math.round(speed/2);

					// do this bit before the promise resolves
					var promise = new $.Deferred();
					this.$scroller.animate({ opacity:0 }, speed, function(){
						promise.resolve();
						this.$scroller.animate({ opacity:1 }, speed);
					}.bind(this));


					return promise;
					break;

				case 'slide':
					scrollPromise = this._scrollTo(-position, speed);
					break;
			}

			return $.when(this.$scroller);
		},

		// Bounce past the end and back in the given direction ("start" or "end").
		//	Returns a promise you can use to do something when animation completes.
		_bouncePage : function(direction, deltaMultiplier, speed) {
			// ignore if we have overlapping items
			if (this.shouldOverlapItems()) return (new $.Deferred()).resolveWith(this);

			var finalPosition = this._getScrollPosition();
			var delta = deltaMultiplier * this.getSizeOfPage(this.pageNumber);

			var animator = this.$scroller;
			animator = this._setPosition(animator, -(finalPosition + delta), speed/2);
			animator = this._setPosition(animator, -(finalPosition), speed/2);
			return $.when(animator);
		},

	//
	//	scroll geometry
	//

		// Return the size of our $scrollMask in our scroll direction
		_getScrollMaskSize : function() {
			if (this.pageDirection === "horizontal") {
				return this.$scrollMask.width();
			} else {
				return this.$scrollMask.height();
			}
		},

		// Scroll to a particular position.  (Position is a positive number).
		_scrollTo : function(position, speed) {
			if (this.shouldOverlapItems()) return;
			this._setPosition(this.$scroller, position, speed);
		},

		// Set the position of some element according to our pageDirection.
		//	if speed is not 0, will animate it.
		_setPosition : function($element, position, speed) {
			var property = (this.pageDirection === "horizontal" ? "left" : "top");
			if (!speed) {
				return $element.css(property, position);
			} else {
				var props = {};
				props[property] = position;
				return $element.animate(props, speed);
			}
		},

		// Return the current scroll position (as a positive number).
		_getScrollPosition : function() {
			if (this.pageDirection === "horizontal") {
				return -parseInt(this.$scroller.css("left"));
			} else {
				return -parseInt(this.$scroller.css("top"));
			}
		}
	});	// end new Class("Carousel")

});	// end define("oak/lib/ui/Carousel")
