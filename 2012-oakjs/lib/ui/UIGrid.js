/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Bit of code to add grid support to Draggable and Resizable.
//	This is automatically included by Draggable and Resizable to give you grid support automatically.
//
//	- UI.Grid.isVisible	 				Returns true if we're currently showing the grid.
//										Set to true or false to change the state.
//										We also add a "ui-grid-visible" class to the <html> element when grid is turned on.
//
//	- UI.Grid.toggle([newState])		Toggle grid visibility on and off.
//										Pass `newState` as a boolean to set explicitly, or omit parameter to toggle current value.
//										This will update existing draggables/resizables as well).
//
//	- UI.Grid.snap		 				Returns true if we're currently snapping to the grid.
//										Set to true or false to change the state.
//										We also add a "UIGridSnap" class to the <html> element when grid is turned on.
//
//	- UI.Grid.toggleSnap([newState])	Toggle grid visibility on and off.
//										Pass `newState` as a boolean to set explicitly, or omit parameter to toggle current value.
//
//	- UI.Grid.size	 					Gets/sets grid size a number (grid is always square).
//										Default is 10px grid.
//										Setting this will update the grid automatically.
//
//	- If you have a button on your page with #GridCheckbox, we'll toggle a 'checked' class on that automatically.
//
//
//	**NOTE:  Implicit dependence on jQuery-UI, which should be included in your main `.html` file.**
//
Module.define("oak/lib/ui/UIGrid",
["oak/lib/ui/UI"],
function(UI, jQueryUI) {
	var _gridSize = 10;
	UI.Grid = Property.extend({}, {
		// should we show the grid?
		isVisible : Property({
			get : function() {
					return !!UI.preference("grid.isVisible")
				  },
			set	: function(turnOn) {
					turnOn = !!turnOn;
					UI.preference("grid.isVisible", turnOn);
					UI.Grid.init();
				  }
		}),

		// should we snap to the grid?
		snap : Property({
			get : function() {
					return !!UI.preference("grid.snap")
				  },
			set	: function(turnOn) {
					turnOn = !!turnOn;
					UI.preference("grid.snap", turnOn);
					UI.Grid.init();
				  }
		}),

		// current size of grid.  Setting will update everything.
		size : Property({
			get : function() {
					return _gridSize;
				  },
			set	: function(newValue) {
					_gridSize = newValue;
					UI.initGrid();
				  }
		}),

		// UI classes to add if the states are on.
		SNAP_TO_GRID_CLASS : "ui-grid-snap",
		SHOW_GRID_CLASS : "ui-grid-visible",

		// Initialize grid.  Updates existing and new draggables/resizables to use current grid setting.
		// Called automatically when UI is initialized.
		// Also called when UI.grid.isVisible, UI.Grid.snap or UI.Grid.size are changed.
		init : function() {
			var snapToGrid = UI.Grid.snap;
			UI.toggleClass(UI.Grid.SNAP_TO_GRID_CLASS, snapToGrid);
			$("#UIGridSnap").toggleClass("checked", snapToGrid);

			var showGrid = snapToGrid || UI.Grid.isVisible;
			UI.toggleClass(UI.Grid.SHOW_GRID_CLASS, showGrid);
			$("#UIGridShow").toggleClass("checked", showGrid)
							.toggleClass("disabled", snapToGrid)
							.prop("disabled", snapToGrid);
		},

		// Toggle the visible state of the grid.
		toggle : function(newState) {
			newState = (newState == null ? !UI.Grid.isVisible : !!newState);
			UI.Grid.isVisible = newState;
		},

		// Toggle the snap state of the grid.
		toggleSnap : function(newState, notify) {
			newState = (newState == null ? !UI.Grid.snap : !!newState);
			UI.Grid.snap = newState;
			if (notify) {
				UI.flashNotice("Grid snap "+(newState ? "on" : "off")+".");
			}
		},
	});

	// initialize us when the UI is ready
	$(UI).on("initialized", UI.Grid.init);


	// add a 'gridSnap' setting to jQueryUI.draggable which snaps the top-left corner to the grid
	if ($.ui.draggable) {
		$.extend(jQuery.ui.draggable.prototype.options, {
			gridSnap		: false,
			gridSnapDelta	: null
		});

		$.ui.plugin.add("draggable", "gridSnap", {
			drag: function(event, ui) {
				if (!UI.Grid.snap) return;
				var gridSize = UI.Grid.size;
				var data = $(this).data("ui-draggable");
				data.position.left = Math.floor(data.position.left / gridSize) * gridSize;
				data.position.top  = Math.floor(data.position.top / gridSize) * gridSize;
				var snapDelta = data.gridSnapDelta;
				if (snapDelta) {
					if (typeof snapDelta == "function") snapDelta = snapDelta();
					data.position.left += (snapDelta.left % gridSize);
					data.position.top += (snapDelta.top % gridSize);
				}
			}
		});
	}

	// add a "gridSnap" setting to jQueryUI.resizable which snaps to the grid when resizing.
	if ($.ui.resizable) {
		$.extend(jQuery.ui.resizable.prototype.options, {
			gridSnap		: false,
			gridSnapDelta	: null
		});

		$.ui.plugin.add("resizable", "gridSnap", {
			resize: function(event, ui) {
				if (!UI.Grid.snap) return;
				var gridSize = UI.Grid.size;
				var data = $(this).data("ui-resizable");
				var snapDelta = data.gridSnapDelta;
				if (snapDelta) {
					if (typeof snapDelta == "function") snapDelta = snapDelta();
				} else {
					snapDelta = {left:0, top:0};
				}
				var axis = data.axis;
				if (axis.contains("n")) {
					var topDelta = (data.position.top % gridSize) - (snapDelta.top % gridSize);
					data.position.top -= topDelta;
					data.size.height += topDelta;
				}
				if (axis.contains("s")) {
					var topDelta = data.position.top % gridSize;
					var height = Math.round(data.size.height / gridSize) * gridSize
					data.size.height = height - topDelta;
				}
				if (axis.contains("w")) {
					var delta = (data.position.left % gridSize) - (snapDelta.left % gridSize);
					data.position.left -= delta;
					data.size.width += delta;
				}
				if (axis.contains("e")) {
					var leftDelta = data.position.left % gridSize;
					var width = Math.round(data.size.width / gridSize) * gridSize
					data.size.width = width - leftDelta;
				}
			}
		});
	}
	return UI.Grid;
});
