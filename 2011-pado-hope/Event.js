/*	
	Browser event helpers.
	
*/

Script.require("", function(){

	// The global string STOP can be used to cancel events from propagating (eg: from .bubble)
	window.STOP = "***STOP***";
	window.CONTINUE = "***CONTINUE***";

	// debug events
	Event.debug = hope.debug("Events");
	Event.showEvents = hope.debug("showEvents");


	hope.extend(Event.prototype, {
		//
		//	`event.stop()` does both stopPropagation and preventDefault().
		//
		stop : function stop() {
			this.preventDefault();
			this.stopPropagation();
		},
	
		// return the first changedTouches object (for gesture event handling)
		//	maps correctly for desktops to the element itself
		touch : Getter(function() {
				return (this.changedTouches ? this.changedTouches[0] : this);
			}
		),
		
		// Return the event's x-coordinate in terms of an element's offsetParent.
		elementX : function(target) {
			if (!target) target = event.target;
			return (this.touch.pageX - target.pageLeft);
		},
		
		// Return the event's y-coordinate in terms of an element's offsetParent.
		elementY : function(target) {
			if (!target) target = event.target;
			return (this.touch.pageY - target.pageTop);
		}
		
	});


	// Static method to prevent event default behavior.
	//	You can pass this to an event handler to turn that event off.
	//		eg:  someWidget.on("mousedown", Event.preventDefault);
	Event.preventDefault = function(event) {
		event.preventDefault();
	}
	

//
//	Mouse-down event normalization:
//		- we capture mousedown and mousemove globally to:
//			- statically remember the current mouse position (Event.pageX, Event.pageY)
//			- statically remember which mouse button is down (Event.mouse)
//			- keep track of the last target element (Event.downTarget)
//			- keep track of the keyboard focus target (Event.focused)
//
//		- this way you can count on these things being set up in your scripts
//			whether you have a pointer to the browser event or not

	window.capture(Browser.EVENT.down, function(event) {
		Event.mouse = (event.which === 1 ? "left" : event.which == 3 ? "right" : "unknown");
		Event.downTarget = event.target;
		Event.pageX = event.touch.pageX;
		Event.pageY = event.touch.pageY;
	});

	window.capture(Browser.EVENT.move, function(event) {
		Event.pageX = event.touch.pageX;
		Event.pageY = event.touch.pageY;
	});

	window.capture(Browser.EVENT.up, function(event) {
		setTimeout(function(){
			Event.mouse = undefined;
			Event.downTarget = undefined;
		}, 0);
	});

	hope.extend(Event, {
		leftButtonIsDown : Getter(function(){ return Event.mouse === "left" }),
		rightButtonIsDown : Getter(function(){ return Event.mouse === "right" }),
		
		// event X coordinate relative to some particular element
		//	pass null to use the Event.mouseTarget
		elementX : function(target) {
			if (!target) target = Event.mouseTarget;
			return Event.pageX - target.pageLeft;
		},

		// event Y coordinate relative to some particular element
		//	pass null to use the Event.mouseTarget
		elementY : function(target) {
			if (!target) target = Event.mouseTarget;
			return Event.pageY - target.pageTop;
		},
		
		elementPoint : function(target) {
			return {x:Event.elementX(target), y:Event.elementY(target)}
		},
		
		pagePoint : Getter(function() {
			return {x:Event.pageX, y:Event.pageY}
		}),
		
		// largest absolute delta between two points
		pointDelta : function(point1, point2) {
			return {x: Math.abs(point1.x - point2.x), y: Math.abs(point1.y - point2.y)};
		}
	});

	
Script.loaded("{{hope}}Event.js");
});// end Script.require()
