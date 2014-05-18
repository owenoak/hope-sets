/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Mixin to make a widget or its items draggable via the jquery.UI "draggable" interface.
//
//	You can mix this in right before you create an object like so:
//			Mixin.mixinTo(MyClass, "Draggable");
//			var myDraggableThing = new MyClass({});
//
//	**NOTE:  Implicit dependence on jQuery-UI, which should be included in your main `.html` file.**
//
Module.define("oak/lib/ui/Draggable",
["oak/lib/core/Mixin"],
function(Mixin) {

	new Mixin("Draggable", {
		// Are we all ready to drag?
		// Set to `true` to make us draggable automatically when shown.
		// Otherwise, you'll have to call initDrag() manually, after which this will be true.
		isDraggable : false,

		// GLOBAL selector for elements which should be draggable.
		// Use "## ..." for elements local to our $root.
		// If specified, will be set up via delegation, so you can add/remove elements willy nilly.
		// If not defined, the widget itself will be draggable.
		dragTargetSelector : undefined,

		// Custom draggable options, see http://api.jqueryui.com/draggable.
		// Set this in your instance before calling initDrag().
		//	NOTE: setting dragOptions on your instance will override/augment these, rather than replace them.
		dragOptions : Property.ProtoMap("dragOptions", {
			// append the "helper" to the body while dragging
			appendTo : "body",

			// stay within the window
			containment	: "window",

			// Set to `true` to print debug messages while dragging.
			debug : false,

			// minimum move distance before drag starts
			distance : 5,

			// clone the dragged element as the drag "helper"
	//TODO: easy way to bind this to a method on the element?
			helper : "clone",

			// by default, don't revert to the original position after a drag
			revert : false,

			// but if we do revert, do it quickly
			revertDuration : 200,

			// "scope" for dropping on droppables, only droppables whose scope matches will accept us.
			// Default is "any" (also the default "scope" of droppables).
			// Set to something else to restrict.
			scope : "any",

			// auto-scroll at the edge while dragging?
			scroll : true,

			// size of scroll edge (only if scroll is true)
			scrollSensitivity : 100,

			// speed of scroll when at edge (only if scroll is true)
			scrollSpeed : 100,

			// opacity for our $dragTarget (NOT the helper) while dragging
			targetOpacity : 1
		}),

		// Cover function to determine actual drag options for this widget.
		// Called automatically on initDrag().
		getDragOptions : function() {
			return this.dragOptions;
		},

		// Add a 'showPlugin' to call initDrag() automatically when shown.
		onShownPlugins : [function(){if (this.isDraggable) this.initDrag()}],

		// Initialize draging for this widget.
		// Note: you should call this each time the grid is updated with new elements.
		initDrag : function() {
			// one-time setup of methods and options
			if (this.__dragInitialized) return this;

			// note that we're now draggable
			this.isDraggable = true;

			// get normalized drag options.
			var dragOptions = this.getDragOptions();

			// intercept dragXXX functions from jquery.UI.draggable to think in terms of our items
			var dragOwner = this;

			// add our custom properties to the jQuery dragInfo object
			function enhanceDragInfo(event, dragInfo, thisObject) {
				// element that was actually dragged
				dragInfo.draggable = $(thisObject);
				// owner element (eg: this widget)
				dragInfo.dragOwner = dragOwner;
				// target JS element (eg: grid item)
				dragInfo.dragTarget = dragOwner.dragTarget;
				// thing that's going to receive the drop (only defined if we're dropping)
				dragInfo.dropOwner = dragOwner.dropOwner;
				// element that we're actually dropping on (only defined if we're dropping)
				dragInfo.droppable = dragOwner.droppable;

				if (dragOptions.debug) {
					console.groupCollapsed(event.type + " event for :", dragOwner);
					console.dir(dragInfo);
					console.groupEnd();
				}
			}

			dragOptions.start = function(event, dragInfo) {
				if (dragOptions.debug) console.info("draggable.start(",arguments,") for ",dragOwner);

				// fire a global "dragStarted" message, so we can watch for on droppables
				$(window).trigger("dragStarted");

				// add a CSS "dragging" class to the <html> element
				UI.addClass("dragging");
				// and remove it when the mouse goes up
				$(document).one("mouseup", function() {
					UI.removeClass("dragging");
				});


				// make sure the thing that's being dragged knows that we're its owner
				$(this).data("dragOwner", dragOwner);

				// remember the data element we're dragging
				dragOwner.dragTarget = dragOwner.getDragTargetForEvent(event, dragInfo);

				// add our custom properties to the dragInfo object
				enhanceDragInfo(event, dragInfo, this);

				// set opacity of our $dragTarget if targetOpacity is specified
				if (dragOptions.targetOpacity != 1) {
					dragInfo.draggable.css("opacity", dragOptions.targetOpacity);
				}
				return dragOwner.onDragStarted(event, dragInfo);
			};

			dragOptions.drag = function(event, dragInfo) {
				if (dragOptions.debug) console.info("draggable.drag(",arguments,") for ",dragOwner);
				enhanceDragInfo(event, dragInfo, this);
				return dragOwner.onDragged(event, dragInfo);
			};

			dragOptions.stop = function(event, dragInfo) {
				if (dragOptions.debug) console.info("draggable.stop(",arguments,") for ",dragOwner);
				enhanceDragInfo(event, dragInfo, this);

				// reset opacity of the $dragTarget if necessary
				if (dragOptions.targetOpacity != 1) {
					dragInfo.draggable.css("opacity", "");
				}

				var returnValue = dragOwner.onDragStopped(event, dragInfo);

				// clean up stuff
				$(this).data("dragOwner", null);
				delete dragOwner.dropOwner;
				delete dragOwner.droppable;
				delete dragOwner.dragTarget;

				return returnValue;
			};

			// if we have a dragTargetSelector, use delegation to make those sub-elements draggable.
			if (this.dragTargetSelector) {
				var $root, selector = this.dragTargetSelector;
				if (selector.startsWith("## ")) {
					$root = this.$root;
					selector = selector.substr(3);
				} else {
					$root = $("body");
				}
				// set up a mouseover event on() target elements so we get delegation
				$root.on("mouseover", selector, function(event) {
					var $target = $(event.currentTarget);
					if (!$target.hasClass("ui-draggable")) {
						$target.draggable(dragOptions);
						if (dragOptions.debug) console.warn("made ", $target, " draggable");
					}
				});
			}
			// otherwise make the root draggable immediately
			else {
				dragOwner.$root.draggable(dragOptions);
				if (dragOptions.debug) console.warn("made ",dragOwner,".$root draggable: ", dragOwner.$root);
			}

			// don't do the one-time-setup stuff again
			this.__dragInitialized = true;

			return this;
		},

	//
	//	event handling
	//
		// Dragging started.
		// Inpect dragInfo for the details.
		onDragStarted : function(event, dragInfo) {},

		// Mouse was moved while dragging.
		// Inpect dragInfo for the details.
		onDragged : function(event, dragInfo) {},

		// Dragging stopped.
		// Inpect dragInfo for the details.
		onDragStopped : function(event, dragInfo) {},

		// Figure out which javascript (sub)element the drag is dealing with.
		//	If your class implements "getItemForEvent(event)", we'll use that.
		//	Otherwise we'll return the widget itself.
		getDragTargetForEvent : function(event, dragInfo) {
			if (this.getItemForEvent) {
				// check both `event.currentTarget` and `event.target`
				return this.getItemForEvent(event, $(event.currentTarget))
					|| this.getItemForEvent(event, $(event.target));
			}
			return this;
		},

	});	// end new Mixin()

	return Mixin.Draggable;
});
