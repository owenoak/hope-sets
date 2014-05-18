/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Mixin to make a widget or its items resizable via the jquery.UI "resizable" interface.
//
//	You can mix this in right before you create an object like so:
//			Mixin.mixinTo(MyGridClass, "Resizable");
//			var myGrid = new MyGridClass({});
//
//
//	**NOTE:  Implicit dependence on jQuery-UI, which should be included in your main `.html` file.**
//
Module.define("oak/lib/ui/Resizable", 
["oak/lib/core/Mixin"], 
function(Mixin) {

	new Mixin("Resizable", {
		// Are we all ready to resize?
		// Set to `true` to make us resizeable automatically when shown.
		// Otherwise, you'll have to call initResize() manually, after which this will be true.
		isResizable : false,

		// GLOBAL selector for elements which should be draggable.
		// Use "## ..." for elements local to our $root.
		// If specified, droppability on these element be set up via delegation, 
		//	so you can add/remove droppables willy nilly.
		resizeTargetSelector : ".",

		// Custom resizable options, see http://api.jqueryui.com/resizable.
		// 	Set this in your instance before calling initResize().
		//	NOTE: setting dragOptions on your instance will override/augment these, rather than replace them.
		resizeOptions : new Property.ProtoMap("resizeOptions", {
			// maintain the same aspect ratio?
			aspectRatio : false,
			
			// hide handles when not auto-hovering?
		//	autoHide : true,
			
			// stay within the document
			containment : "document",

			// delay before resizing starts
//			delay : 150, 
			
			// Set to `true` to debug resizing on this element.
			debug : false,
			
			// minimum move distance before resize starts
			distance : 5,
			
			// resize edges
			handles : "all",
			
		}),

		// Add a 'showPlugin' to call initResize() automatically when shown.
		onShownPlugins : [function(){if (this.isResizable) this.initResize()}],
				
		// Initialize resizing for this widget.
		// Note: you should call this each time the grid is updated with new elements.
		initResize : function() {
			// one-time setup of methods and options
			if (this.__resizeInitialized) return this;

			// note that we're now resizable
			this.isResizable = true;
			
			// set to a selector to define which of our sub-elements are resizable
			if (!this.resizeTargetSelector) {
				console.warn(this,".initResize(): you MUST define a resizeTargetSelector");
				return this;
			}
			
			// get the normalized list of resizeOptions
			var resizeOptions = this.resizeOptions;

			// we intercept resizeXXX functions from jquery.UI.resizable
			//	to think in terms of our items
			var resizeOwner = this, resizeAxis;

			// add our custom properties to the jQuery dragInfo object
			function enhanceResizeInfo(event, resizeInfo, thisObject) {
				// resize "axis" (n, s, e, w, ne, etc).
				resizeInfo.axis = resizeAxis;
				// owner element (eg: this widget)
				resizeInfo.resizeOwner = resizeOwner;
				// target JS element (eg: grid item)
				resizeInfo.resizeTarget = resizeOwner.resizeTarget;
				
				if (!resizeOptions.debug) return;
				console.groupCollapsed(event.type + " event for :", resizeOwner);
				console.dir(resizeInfo);
				console.groupEnd();
			}

			resizeOptions.start = function(event, resizeInfo) {
				// add our custom properties to the resizeInfo object
				enhanceResizeInfo(event, resizeInfo, this);
				return resizeOwner.onResizeStarted(event, resizeInfo);
			};
	
			resizeOptions.resize = function(event, resizeInfo) {
				enhanceResizeInfo(event, resizeInfo, this);
				return resizeOwner.onResized(event, resizeInfo);		
			};
	
			resizeOptions.stop = function(event, resizeInfo) {
				enhanceResizeInfo(event, resizeInfo, this);
				delete resizeOwner.resizeTarget;
				return resizeOwner.onResizeStopped(event, resizeInfo);
			};

			// when a resizable is set up, give us a custom event 
			//	so we can adjust things depending, eg, on which handle they clicked on
			//  BEFORE the event handling starts
			resizeOptions.create = function(event) {
				var $resizeTarget = $(event.target);
				// set up a 'capture' event in all of our resize handles, so we can pre-process
				$resizeTarget.find(".ui-resizable-handle").captureEvent("mousedown", function(event) {
					// figure out which handle they started pulling on.
					//	unfortunately, jQueryUI doesn't make this easy...
					var resizeHandle = event.currentTarget;
					var match = resizeHandle.className.match(/ui-resizable-([nsew][nsew]?)\b/);
					resizeAxis = (match ? match[1] : "UNKNOWN");	// set to "UNKNOWN" if we can't figure it out.
					
					// figure out which JS object is the target of the event
					resizeOwner.resizeTarget = resizeOwner.getResizeTargetForEvent(event, $resizeTarget);
					
					// synthesize important bits of the resizeInfo object
					var resizeInfo = {
						element : $resizeTarget,
						originalElement : $resizeTarget
					}

					enhanceResizeInfo(event, resizeInfo, this);
					return resizeOwner.onResizeStarting(event, resizeInfo);
				});
			}

			// if we have a resizeTargetSelector, use delegation to make those sub-elements resizable.
			if (this.resizeTargetSelector) {
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
					if (!$target.hasClass("ui-resizable")) {
						$target.resizable(resizeOptions);
						if (resizeOptions.debug) console.warn("made ", $target, " resizable");
					}
				});
			} 
			// otherwise make the root resizable immediately
			else {
				resizeOwner.$root.resizable(resizeOptions);
				if (resizeOptions.debug) console.warn("made ",resizeOwner,".$root resizable: ", resizeOwner.$root);
			}

			// don't do the one-time-setup stuff again
			this.__resizeInitialized = true;

			return this;
		},

		// turn aspect ratio constraint on/off while resizing.
		// HACKY: looking into jQuery UI internals to set this, doesn't seem to be another way...
		resizeSetAspectRatio : function(event, resizeInfo, maintainAspectRatio) {
			var $element = (resizeInfo ? resizeInfo.originalElement : null);
			var data = ($element ? $element.data("ui-resizable") : null);
			if (data) data._aspectRatio = maintainAspectRatio;
		},

	//
	//	event handling
	//
		// Resizing is about to start.
		// Inpect resizeInfo for the details.
		onResizeStarting : function(event, resizeInfo) {},

		// Resizing started.
		// Inpect resizeInfo for the details.
		onResizeStarted : function(event, resizeInfo) {},
		
		// Resizing happened.
		// Inpect resizeInfo for the details.
		onResized : function(event, resizeInfo) {},
		
		// Resizing stopped.
		// Inpect resizeInfo for the details.
		onResizeStopped : function(event, resizeInfo) {},

		// Figure out which javascript (sub)element the resize is dealing with.
		//	If your class implements "getItemForEvent(event)", we'll use that.
		//	Otherwise we'll return the widget itself.
		getResizeTargetForEvent : function(event, $element) {
			if (this.getItemForEvent) return this.getItemForEvent(event, $element);
			return this;
		},
	
	});	// end new Mixin()

	return Mixin.Resizable;
});
