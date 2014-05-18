/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Make a large $scroller scroll in one direction by pages within a clipping $scrollMask.
//	We assume that the content is all present in the $scroller and doesn't change while we're scrolling.
//
//	NOTE: This version assumes all pages are the same size.
//

Module.define("oak/lib/ui/PageScroller",
"oak/lib/core/Mixin,oak/lib/ui/Pageable",
function(Mixin, Pageable) {

	// start with everything in Pageable
	var properties = Property.clone(Pageable);
	return new Mixin("PageScroller", Property.extend(properties, {

	//
	//	YOUR IMPLEMENTATION MUST SET UP THE FOLLOWING!
	//

		parts : {
			// Very large element which shows your content and moves back and forth to scroll.
			$scroller	: "## .Scroller",

			// Element which clips the $scroller.
			//	Also used to get the size of each "page".
			$scrollMask	: "## .ScrollMask"
		},

	// END IMPLEMENTATION SPECIFIC

		// We're ready to scroll if our $scrollMask is non-zero width.
		//	Otherwise we're not drawn yet.
		isReadyToPage : function() {
			return this._getScrollMaskSize() !== 0;
		},

		// Return the size of some page, in pixels.
		//	NOTE: we assume we're always paging in uniform increments of the $scrollMask's size,
		//		  ignoring the pageNumber passed in.
		getSizeOfPage : function(pageNumber) {
			return this._getScrollMaskSize();
		},

		// Return the current number of pages, by calculating the max scroll against the page size.
		// NOTE: this assumes all pages are the same size!
		pageCount : Property.Getter(function() {
			var max = this._getScrollerSize();
			var pageSize = this.getSizeOfPage(0);
			return (pageSize === 0 ? 0 : Math.ceil(max / pageSize));
		}),

		// Animate so the current page is visible.
		//	Returns a promise you can use to do something when animation completes.
		_animateToCurrentPage : function(direction) {
			// figure out where the scroll should end up
			var position = this.getSizeOfPages(0, this.pageNumber);
			this._scrollTo(position, this.pageSpeed);
			return $.when(this.$scroller);
		},

		// Bounce past the end and back in the given direction ("start" or "end").
		//	Returns a promise you can use to do something when animation completes.
		_bouncePage : function(direction, delta, speed) {
			var finalPosition = this._getScrollPosition();

			// because _scrollTo devolves down into a $scroller.animate(),
			//	we can call it repeatedly and just return a promise when the $scroller finishes animating
			this._scrollTo(finalPosition + delta, speed/2);
			this._scrollTo(finalPosition, speed/2);
			return $.when(this.$scroller);
		},

		// Update the display for our current pageNumber.
		// NOTE: we don't actually do anything here, assuming the content is all in place.
		_updateContentsForCurrentPage : function() {
			return;
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

		// Return the current size of the scroller.
		_getScrollerSize : function() {
			if (this.pageDirection === "horizontal") {
				return this.$scroller.width();
			} else {
				return this.$scroller.height();
			}
		},

		// Scroll to a particular position.  (Position is a positive number).
		_scrollTo : function(position, speed) {
				if (speed == null) speed = this.pageSpeed;

			if (this.pageDirection === "horizontal") {
				var css = {left:-position};
			} else {
				var css = {top:-position};
			}
			this.$scroller.animate(css, speed);
		}

		// Return the current scroll position (as a positive number).
		_getScrollPosition : function() {
			if (this.pageDirection === "horizontal") {
				return -this.$scroller.css("left");
			} else {
				return -this.$scroller.css("top");
			}
		}

	});

});	// end define("oak/lib/ui/PageScroller")
