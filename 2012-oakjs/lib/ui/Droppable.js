/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Mixin to make a widget or its items droppable via the jquery.UI "droppable" interface.
//  Note: this is optimized to work with our Draggable module.
//
//	You can mix this in right before you create an object like so:
//			Mixin.mixinTo(MyGridClass, "Droppable");
//			var myGrid = new MyGridClass({});
//
//	**NOTE:  Implicit dependence on jQuery-UI, which should be included in your main `.html` file.**
//
Module.define("oak/lib/ui/Droppable",
["oak/lib/core/Mixin"],
function(Mixin) {

	new Mixin("Droppable", {
		// Are we all ready to drop?
		// Set to `true` to make us droppable automatically when shown.
		// Otherwise, you'll have to call initDrop() manually, after which this will be true.
		isDroppable : false,

		// GLOBAL selector for elements which should be droppable.
		// Use "## ..." for elements local to our $root.
		// If specified, droppability on these element be set up via delegation,
		//	so you can add/remove droppables willy nilly.
		// See also "canDropOnRoot" below.
		dropTargetSelector : undefined,

		// Custom droppable options, see http://api.jqueryui.com/droppable.
		// Set this in your instance before calling initDrop().
		//	NOTE: setting dropOptions on your instance will override/augment these, rather than replace them.
		dropOptions : new Property.ProtoMap("dropOptions", {
			// CSS class added to droppable when some draggable is active
			activeClass : "droppable",

			// If true, we allow dropping on our $root element.
			canDropOnRoot : true,

			// Set to `true` to print debug messages while dropping.
			debug : false,

			// if we're inside another droppable, we'll steal the drop rather than passing it to the parent
			greedy : true,

			// CSS class added to droppable when an acceptible dragTarget is hovering over us
			hoverClass : "dropping",

			// how we determine drop over, values:  "fit", "intersect", "pointer, "touch"
			tolerance : "pointer",

			// "scope" of draggables we'll accept.
			// Default is "any" (also the default "scope" of draggables).
			// Set to something else to restrict.
			scope : "any",
		}),

		// Add a 'showPlugin' to call initDrop() automatically when shown.
		onShownPlugins : [function(){ if (this.isDroppable) this.initDrop()}],

		// Initialize droping for this widget.
		// Note: you should call this each time the grid is updated with new elements.
		initDrop : function() {
			// one-time setup of methods and options, bail if we've already done this.
			if (this.__dropInitialized) return this;

			// note that we're now resizable
			this.isDroppable = true;

			// mix item-specific options with default options defined on the class...
			var dropOptions = this.dropOptions;

			// we intercept dropXXX functions from jquery.UI.droppable
			//	to think in terms of our items
			var droppable = this;

			// add our custom properties to the jQuery dropInfo object
			function enhanceDropInfo(event, dropInfo, thisObject) {
				// element that is actually being dropped
				dropInfo.droppable = $(thisObject);
				// owner of the drop (eg: this widget)
				dropInfo.dropOwner = droppable;
				// owner of the thing we're dragging FROM
				dropInfo.dragOwner = dropInfo.draggable.data("dragOwner");
				// data sub-element of the dragOwner we're dragging (eg: grid item)
				dropInfo.dragTarget = dropInfo.dragOwner.dragTarget;

				if (!dropOptions.debug) return;
				console.groupCollapsed(event.type + " event for :", droppable);
				console.dir(dropInfo);
				console.groupEnd();
			}

			dropOptions.over = function(event, dropInfo) {
				if (dropOptions.debug) console.info("droppable.over(",arguments,") for ",dragOwner);
				enhanceDropInfo(event, dropInfo, this);
				if (dropInfo.dragOwner) {
					dropInfo.dragOwner.dropOwner = droppable;
					dropInfo.dragOwner.droppable = dropInfo.droppable;
				}
				return droppable.onDropOver(event, dropInfo);
			};

			dropOptions.out = function(event, dropInfo) {
				if (dropOptions.debug) console.info("droppable.out(",arguments,") for ",dragOwner);
				enhanceDropInfo(event, dropInfo, this);
				return droppable.onDropOut(event, dropInfo);
			};

			dropOptions.drop = function(event, dropInfo) {
				if (dropOptions.debug) console.info("droppable.drop(",arguments,") for ",dragOwner);
				enhanceDropInfo(event, dropInfo, this);
				return droppable.onDropped(event, dropInfo);
			};

			// if we have a dropTargetSelector, use delegation to make those sub-elements droppable.
			if (this.dropTargetSelector) {
				var $root, selector = this.dropTargetSelector;
				if (selector.startsWith("## ")) {
					$root = this.$root;
					selector = selector.substr(3);
				} else {
					$root = $("body");
				}
				// when dragging starts with our Draggable mixin, the window will be sent a "dragStarted" event.
				//	watch that to make any of our drop targets droppable if they're not droppable already.
				var nonDroppableTargetSelector = selector+":not(.ui-droppable)";
				$(window).on("dragStarted", function(event) {
					var $nonDroppables = $root.find(nonDroppableTargetSelector);
					if ($nonDroppables.length) {
						$nonDroppables.droppable(dropOptions);
						if (dropOptions.debug) console.warn("made ", $nonDroppables, " droppable");
					}
				});
			}

			// if canDropOnRoot is true we make the root droppable immediately.
			// Otherwise we depend on a window:dragStarted event to make us droppable.
			if (dropOptions.canDropOnRoot) {
				this.$root.droppable(dropOptions);
				if (dropOptions.debug) console.warn("made ",this,".$root droppable: ", this.$root);
			}

			// don't call again
			this.__dropInitialized = true;

			return this;
		},

	//
	//	event handling
	//
		// Droppable item entered our airspace.
		onDropOver : function(event, dropInfo, dragOwner, dragTarget) {},

		// Droppable item left our airspace.
		onDropOut : function(event, dropInfo, dragOwner, dragTarget) {},

		// Droppable item was released in our airspace.
		onDropped : function(event, dropInfo, dragOwner, dragTarget) {},

	});	// end new Mixin()

	return Mixin.Droppable;
});
