/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Bit of code to add drag support to constrain horizontally or vertically as the shift key is held down.
//	Turn it on by adding "autoConstrain" to your draggable when setting it up.
//
//
//	**NOTE:  Implicit dependence on jQuery-UI, which should be included in your main `.html` file.**
//
Module.define("oak/lib/ui/UIAutoConstrainDrag",
["oak/lib/ui/UI", "oak/lib/ui/KeyMap"],
function(UI, KeyMap) {
	// add a 'autoConstrain' setting to jQueryUI.draggable which constrains drag axis if the shift key is down
	if ($.ui.draggable) {
		$.ui.plugin.add("draggable", "autoConstrain", {
			drag: function(event, ui) {
				var data = $(this).data("ui-draggable");
				// if shift key is not down, forget it
				if (!UI.keys.SHIFT) {
					// make sure to clean up after ourselves!
					delete data.autoConstrain;
					return;
				}

				// if constrain hasn't been set up, just remember the start position
				//	and we'll pick up the axis when they've moved a little bit
				if (!data.autoConstrain) {
					data.autoConstrain = {
						start : ui.position
					}
					return;
				}

				// if data.axis is not set, we don't know our axis yet
				//	figure it out based on a movement over a small threshold
				if (!data.autoConstrain.axis) {
					var minimalDelta = 5;
					var leftDelta = Math.abs(ui.position.left - data.autoConstrain.start.left);
					var topDelta  = Math.abs(ui.position.top  - data.autoConstrain.start.top);
					if 		(leftDelta > minimalDelta  && leftDelta > topDelta) 	data.autoConstrain.axis = "h";
					else if (topDelta > minimalDelta   && topDelta > leftDelta)		data.autoConstrain.axis = "v";
				}

				// if we have an axis now, constrain to the left/top set in data.autoConstrain.start
				if (data.autoConstrain.axis == "h") data.position.top  = data.autoConstrain.start.top;
				if (data.autoConstrain.axis == "v") data.position.left = data.autoConstrain.start.left;
			},

			stop : function() {
				var data = $(this).data("ui-draggable");
				delete data.autoConstrain;
			}
		});
	}
	return UI;
});
