/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Bit of code to add guide support to Draggable and Resizable.
//	This is automatically included by Draggable and Resizable to give you guide support automatically.
//
//	- UI.Guides.areVisible				Returns true if guides are currently visible.
//										We also add a "ui-guides-visible" class to the <html> element when guides are turned on.
//	- UI.Guides.toggle([newState])		Toggle guide visibility on or off.
//										Pass `newState` as a boolean to set explicitly, or omit parameter to toggle current value.
//										This will update existing draggables/resizables as well).
//	- UI.Guides.snap					Returns true if guides are currently snappy.
//										NOTE: if `Guides.snap` is on, we'll ALWAYS show the guides, no matter the state of `Guides.areVisible`.
//										We also add a "ui-guides-snap" class to the <html> element when guides are turned on.
//	- UI.Guides.toggleSnap([newState])	Toggle guide snapping on or off.
//										Pass `newState` as a boolean to set explicitly, or omit parameter to toggle current value.
//										This will update existing draggables/resizables as well).
//
//	- If you have a button on your page with #GuidesCheckbox, we'll toggle a 'checked' class on that automatically.
//
//
//	**NOTE:  Implicit dependence on jQuery-UI, which should be included in your main `.html` file.**
//
Module.define("oak/lib/ui/UIGuides",
"oak/lib/ui/UI,oak/lib/js/Math",
function(UI, Math) {
	UI.Guides = Property.extend({}, {
		// set to true to debug
		debug : false,

		// should we show the guides?
		areVisible : Property({
			get : function() {
					return !!UI.preference("guides.areVisible")
				  },
			set	: function(turnOn) {
					turnOn = !!turnOn;
					UI.preference("guides.areVisible", !!turnOn);
					UI.Guides.init();
				  }
		}),

		// should we snap to the guides?
		snap : Property({
			get : function() {
					return !!UI.preference("guides.snap")
				  },
			set	: function(turnOn) {
					turnOn = !!turnOn;
					UI.preference("guides.snap", !!turnOn);
					UI.Guides.init();
				  }
		}),


		// Initialize guides.  Updates existing and new draggables/resizables to use current guide setting.
		// Called automatically when UI is initialized.
		// Also called when UI.Guides.areOn is changed.
		init : function() {
			var snapToGuides = UI.Guides.snap;
			$("html").toggleClass("ui-guides-snap", snapToGuides);
			$("#UIGuidesSnap").toggleClass("checked", snapToGuides);

			var showGuides = snapToGuides || UI.Guides.areVisible;
			$("html").toggleClass("ui-guides-visible", showGuides);
			$("#UIGuidesShow").toggleClass("checked", showGuides)
							.toggleClass("disabled", snapToGuides)
							.prop("disabled", snapToGuides);
		},

		// Toggle the visible state of the guides.
		toggle : function(newState) {
			newState = (newState == null ? !UI.Guides.areVisible : !!newState);
			UI.Guides.areVisible = newState;
		},

		// Toggle the snap state of the guides.
		toggleSnap : function(newState, notify) {
			newState = (newState == null ? !UI.Guides.snap : !!newState);
			UI.Guides.snap = newState;
			if (notify) {
				UI.flashNotice("Guide snap "+(newState ? "on" : "off")+".");
			}
		},
	});

	// initialize us when the UI is ready
	$(UI).on("initialized", UI.Guides.init);


	// helper method to set up guides, called by both draggable and resizable
	function initGuides($element, data) {
		data.guides = { horizontal:[], vertical:[] };

		// remember offset of the element we're moving (NOT the guide parent)
		var offset = $element.offsetParent().offset();
		offset.left = Math.round(offset.left);
		offset.top = Math.round(offset.top);
		data.guides.offset = offset;

		// figure out our guideParent -- the guy who owns the <guide> elements
		var guideParent = data.options.guideParent, $parent;
		if (typeof guideParent === "string") {
			$parent = (guideParent === "offsetParent" ? $element.offsetParent() : $element.parent(guideParent));
		} else if (typeof guideParent === "function") {
			$parent = guideParent();
		} else if (guideParent instanceof jQuery) {
			$parent = guideParent;
		}
		if (!$parent) throw "Don't understand guideParent "+guideParent;

		var parentSize = $parent.size();
		var parentOffset = $parent.offset();

		// find the guide elements...
		var $guides = $parent.find("guide");
		// ... and figure out their positions,
		//		remembering them each as  [guideLocation, guideMin, guideMax]
		var tolerance = data.options.guideTolerance;
		$guides.each(function(index, guide) {
			var $guide = $(guide);
			if ($guide.hasClass("h")) {
				var left = Math.round($guide.offset().left);
				data.guides.horizontal.push([left, left-tolerance, left+tolerance, $guide]);
			} else {
				var top = Math.round($guide.offset().top);
				data.guides.vertical.push([top, top-tolerance, top+tolerance, $guide]);
			}
		});

		// add implicit guides for page center if necessary
		var guideCenter = data.options.guideCenter;
		if (guideCenter == true || guideCenter == "h") {
			var center = Math.round( (parentSize.width/2) + parentOffset.left);
			data.guides.horizontal.push([center, center-tolerance, center+tolerance, "h center"]);
		}
		if (guideCenter == true || guideCenter == "v") {
			center = Math.round( (parentSize.height/2) + parentOffset.top);
			data.guides.vertical.push([center, center-tolerance, center+tolerance, "v center"]);
		}

		// add implicit guides for edges if specified
		if (data.options.guideEdges) {
			var edge = Math.round(0 + parentOffset.left);
			data.guides.horizontal.push([edge, edge, edge+tolerance, "left edge"]);

			edge = Math.round(parentSize.width + parentOffset.left) - 1;	// -1 to stay within the page, otherwise we'll bleed
			data.guides.horizontal.push([edge, edge-tolerance, edge, "right edge"]);

			edge = Math.round(0 + parentOffset.top);
			data.guides.vertical.push([edge, edge, edge+tolerance, "top edge"]);

			edge = Math.round(parentSize.height + parentOffset.top) - 1;	// -1 to stay within the page, otherwise we'll bleed
			data.guides.vertical.push([edge, edge-tolerance, edge, "bottom edge"]);
		}

		// sort the guides (mainly for debugging)
		data.guides.horizontal.sort(function(a,b){return a[0] - b[0]});
		data.guides.vertical.sort(function(a,b){return a[0] - b[0]});


		if (UI.Guides.debug) {
			console.log(data.guides.offset);
			console.group("horizontal guides:");
			console.dir(data.guides.horizontal);
			console.groupEnd();
			console.group("vertical guides:");
			console.dir(data.guides.horizontal);
			console.groupEnd();
		}
	}


	// add a 'guides' setting to jQueryUI.draggable which snaps to the guides
	if ($.ui.draggable) {
		$.extend(jQuery.ui.draggable.prototype.options, {
			guides			: false,			// set to true to use guides when dragging.
			guideParent		: "offsetParent",	// "offsetParent" or selector for our parent who owns the <guide>s
			guideTolerance	: 8,				// slop around guide we use to snap
			guideEdges		: true,				// if true, we automatically create a guide at the edges of the guideParent
			guideCenter		: true,				// if true, we automatically create a guide at the center of the guideParent
		});

		$.ui.plugin.add("draggable", "guides", {
			// NOTE: set up guides even if snap is off,
			//		 since we should be able to turn guides on/off while dragging.
			// FOR SOME REASON THIS DOESN'T WORK???
			start : function(event, ui) {
				if (!UI.Guides.snap) return;

				var $element = $(this);
				initGuides($element, $element.data("ui-draggable"));
			},
			drag: function(event, ui) {
				if (!UI.Guides.snap) return;

				var $this = $(this);
				var data = $this.data("ui-draggable");

				// check horizontal guides
				var hGuides = data.guides.horizontal;
				var hOffset = data.guides.offset.left;
				var width = ui.helper.outerWidth();
				var left = Math.round(data.position.left + hOffset);
				var right = Math.round(left + width);
				for (var i = 0; i < hGuides.length; i++) {
					var guide = hGuides[i];
					var guideLeft = guide[0], guideMin = guide[1], guideMax = guide[2];
					// snap on left
					if ( (left >= guideMin) && (left <= guideMax) ) {
						data.position.left = guideLeft - hOffset;
						if (UI.Guides.debug) console.warn("left snap to ",guide[3], left, guideLeft);
						break;
					}
					// snap on right
					if ( (right >= guideMin) && (right <= guideMax) ) {
						if (UI.Guides.debug) console.warn("right snap to ",guide[3], right, guideLeft);
						data.position.left = guideLeft - hOffset - width + 1;
						break;
					}
				}

				// check vertical guides
				var vGuides = data.guides.vertical;
				var vOffset = data.guides.offset.top;
				var height = ui.helper.outerHeight();
				var top = Math.round(data.position.top + vOffset);
				var bottom = Math.round(top + height);
				for (var i = 0; i < vGuides.length; i++) {
					var guide = vGuides[i];
					var guideTop = guide[0], guideMin = guide[1], guideMax = guide[2];
					// snap on top
					if ( (top >= guideMin) && (top <= guideMax) ) {
						if (UI.Guides.debug) console.warn("top snap to ",guide[3], top, guideTop);
						data.position.top = guideTop - vOffset;
						break;
					}
					// snap on bottom
					if ( (bottom >= guideMin) && (bottom <= guideMax) ) {
						if (UI.Guides.debug) console.warn("bottom snap to ",guide[3], bottom, guideTop);
						data.position.top = guideTop - vOffset - height + 1;
						break;
					}
				}
			}
		});
	}


	// add a "gridSnap" setting to jQueryUI.resizable which snaps to the guide when resizing.
	if ($.ui.resizable) {
		$.extend(jQuery.ui.resizable.prototype.options, {
			guides			: false,			// set to true to use guides when dragging.
			guideParent		: "offsetParent",	// "offsetParent" or selector for our parent who owns the <guide>s
			guideTolerance	: 8,				// slop around guide we use to snap
			guideEdges		: true,				// if true, we automatically create a guide at the edges of the guideParent
			guideCenter		: true,				// if true, we automatically create a guide at the center of the guideParent
		});

		$.ui.plugin.add("resizable", "guides", {
			// NOTE: set up guides even if snap is off,
			//		 since we should be able to turn guides on/off while dragging.
			// FOR SOME REASON THIS DOESN'T WORK???
			start : function(event, ui) {
				if (!UI.Guides.snap) return;

				var $element = $(this);
				initGuides($element, $element.data("ui-resizable"));
			},
			resize: function(event, ui) {
				if (!UI.Guides.snap) return;

				var $this = $(this);
				var data = $this.data("ui-resizable");
				var axis = data.axis;

				var checkLeft = axis.contains("w"), checkRight = axis.contains("e");
				if (checkLeft || checkRight) {
					var hGuides = data.guides.horizontal;
					var hOffset = data.guides.offset.left;
					var width = data.size.width;
					var left = data.position.left + hOffset;
					var right = left + width;
					for (var i = 0; i < hGuides.length; i++) {
						var guide = hGuides[i];
						var guideLeft = guide[0], guideMin = guide[1], guideMax = guide[2];
						// snap on left
						if ( checkLeft && (left > guideMin) && (left < guideMax) ) {
							var leftDelta = left - guideLeft;
							data.position.left -= leftDelta;
							data.size.width += leftDelta + 1;
							break;
						}
						// snap on right
						if ( checkRight && (right > guideMin) && (right < guideMax) ) {
							data.size.width = (guideLeft - left) + 1;
							break;
						}
					}
				}

				var checkTop = axis.contains("n"), checkBottom = axis.contains("s");
				if (checkTop || checkBottom) {
					var vGuides = data.guides.vertical;
					var vOffset = data.guides.offset.top;
					var height = data.size.height;
					var top = data.position.top + vOffset;
					var bottom = top + height;
					for (var i = 0; i < vGuides.length; i++) {
						var guide = vGuides[i];
						var guideTop = guide[0], guideMin = guide[1], guideMax = guide[2];
						// snap on top
						if ( checkTop && (top > guideMin) && (top < guideMax) ) {
							var topDelta = top - guideTop;
							data.position.top -= topDelta;
							data.size.height += topDelta + 1;
							break;
						}
						// snap on bottom
						if ( checkBottom && (bottom > guideMin) && (bottom < guideMax) ) {
							data.size.height = (guideTop - top) + 1;
							break;
						}
					}
				}

				// normalize to integer coordinates
				Math.integerRect(data.position);
				Math.integerRect(data.size);
			}
		});
	}

	return UI.Guides;
});
