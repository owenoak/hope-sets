/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Turn some widget into a page scrolling widget.
//
//	NOTE: this is dependent on you setting your HTML up exactly right!
//

Module.define("oak/lib/ui/Swipeable", "oak/lib/core/Mixin", function(Mixin) {

	return new Mixin("Swipeable", {
		// indicator that we are Swipeable
		isSwipeable : true,

		// page direction
		pageDirections : ["horizontal", "vertical"],
		pageDirection : "vertical",

		// speed to animate page transitions
		swipeSpeed	: 200,	
					
	//
	//	swipe event handling
	//
		startSwiping : function() {
			// set up swipe events
			this.$root.swipe({
				swipe : this.bind("_onSwipe")
			});
		},
	
		_onSwipe : function(event, direction, distance, duration, fingerCount) {
			switch(direction) {
				case "up"		: result = this.onSwipeUp(event); break;
				case "down"		: result = this.onSwipeDown(event); break;
				case "left"		: result = this.onSwipeLeft(event); break;
				case "right"	: result = this.onSwipeRight(event); break;
			}

			event.preventDefault();
			event.stopPropagation();
			
			// HACKY: set a "swiping" flag so we can detect that we're swiping
			//	and not fire any "click" events while swiping.
			this.isSwiping = true;
			setTimeout(function(){this.isSwiping = false}.bind(this),100);
		},

	//
	//	default is to call showNextPage() or showPrevPage()
	//
		
		onSwipeUp : function() {
			if (this.pageDirection === "vertical") {
				return this.showNextPage();
			}
			return false;
		},
		
		onSwipeDown : function() {
			if (this.pageDirection === "vertical") {
				return this.showPrevPage();
			}
			return false;
		},
		
		onSwipeLeft : function() {
			if (this.pageDirection === "horizontal") {
				return this.showNextPage();
			}
			return false;
		},
		
		onSwipeRight : function() {
			if (this.pageDirection === "horizontal") {
				return this.showPrevPage();
			}
			return false;		
		},


		// Animate to the correct position to show (some portion of) a page.
		_animateToPosition : function(position, speed) {
			var property = (this.pageDirection === "vertical" ? "top" : "left");
			var props = {};
			props[property] = position;
			return $.when(this.$root.animate(props, speed));
		},
		
		// Bounce at the beginning or end of the list to indicate we're at the end.
		// amount to bounce when we get to the end
		bounceDelta : 100,
		bounce : function(start, speed, direction) {
			// divide speed in half since there are 2 parts to the animation
			speed = (parseInt(speed)/2);
			if (isNaN(speed)) speed = 100;	// handle "fast", etc
			
			bounceDelta = this.bounceDelta * (direction === "end" ? -1 : 1);
			var self = this;
			self._animateToPosition(start+bounceDelta, speed).done(
				function() {
					self._animateToPosition(start, speed);
				})
		},
				
	});	// end new Mixin()
});	// end define("oak/lib/ui/Swipeable")
