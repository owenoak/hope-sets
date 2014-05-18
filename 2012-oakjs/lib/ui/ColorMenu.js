/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Color Menu.
//
// 	TODO: change colors?
//


Module.define("oak/lib/ui/ColorMenu",
"oak/lib/jquery/jquery.extensions,oak/lib/ui/ContextMenu",
function($, ContextMenu) {

	var ColorMenu = new Class("ColorMenu", "ContextMenu",
	// instance properties
	{
		parts : {
			$rows	: "LIVE:## .Row",
			$cells	: "LIVE:## .Cell",
		},

		// don't apply a CSS class to the target when showing
		activeTargetClass : undefined,

		autoHide : false,


		widgetTemplate  			: "<div id='{{id}}' class='{{className}} ColorMenu'></div>",
		rowTemplate					: "<div class='row'>{{cells}}</div>",
		cellTemplate				: "<div class='cell' color='{{color}}' title='{{color}}' style='background-color:{{color}}'></div>",

		customRowTemplate			: "<div class='customRow' row='{{id}}' editable='{{editable}}'></div>",
		customRowTitleTemplate		: "<div class='title'>{{title}}</div>",
		customCellTemplate			: "<div class='customCell' color='{{color}}' column='{{column}}' title='{{color}}' style='background-color:{{color}}'></div>",
		editableEmptyCellTemplate	: "<div class='customCell empty' color='?' column='{{column}}' title='Click to set color'></div>",
		readOnlyEmptyCellTemplate	: "<div class='stubCell'></div>",

// TODO...
		customEditRowTemplate		: "<div class='editRow' row='{{rowId}}' column='{{column}}'>"
											+"<div class='title'>New color?</div>"
											+" #<input class='colorEditor' value='{{color}}' onkeydown='UI.{{id}}.onEditColorKeypress(event)' onkeyup='UI.{{id}}.onEditColorKeyup(event)'>"
											+" <button class='ok shiny selected compact' onclick='UI.{{id}}.saveCustomColor()'>OK</button>"
											+" <button class='cancel shiny compact' onclick='UI.{{id}}.hide()'>Cancel</button>"
									+ "</div>",

		// colors to use, an array of arrays.
		colors : [
			['transparent', 'black',   '#eeece1', '#1f497d', '#4f81bd', '#c0504d', '#9bbb59', '#8064a2', '#4bacc6', '#f79646', '#ffff00'],
			['white',   	'#999999', '#ddd9c3', '#c6d9f0', '#dbe5f1', '#f2dcdb', '#ebf1dd', '#e5e0ec', '#dbeef3', '#fdeada', '#fff2ca'],
			['#eeeeee', 	'#777777', '#c4bd97', '#8db3e2', '#b8cce4', '#e5b9b7', '#d7e3bc', '#ccc1d9', '#b7dde8', '#fbd5b5', '#ffe694'],
			['#dddddd', 	'#555555', '#938953', '#548dd4', '#95b3d7', '#d99694', '#c3d69b', '#b2a2c7', '#b7dde8', '#fac08f', '#f2c314'],
			['#bbbbbb', 	'#333333', '#494429', '#17365d', '#366092', '#953734', '#76923c', '#5f497a', '#92cddc', '#e36c09', '#c09100'],
			['#aaaaaa', 	'#222222', '#1d1b10', '#0f243e', '#244061', '#632423', '#4f6128', '#3f3151', '#31859b', '#974806', '#7f6000']
		],

		events : [
			{ selector:"## .cell", event:"click", handler:"onColorClicked" },
			{ selector:"## .customCell", event:"click", handler:"onCustomColorClicked" }
		],

	//
	//	showing/hiding
	//

		onReady : function() {
			this.customRows = {};

			this.$root.html(this.getColorsHTML());
			this.asContextMenu("onReady");
		},

		onShowing : function(currentColor, doneHandler) {
			// select current color if defined & available
			if (currentColor) this.$root.find(".Cell[color='"+currentColor+"']").addClass("selected");
			this.doneHandler = doneHandler;

			// update any customRows that have `loaders`
			for (var key in this.customRows) {
				var row = this.customRows[key];
				if (row.update) row.update(row);
				this.updateCustomRow(row);
			}

			this.asContextMenu("onShowing");
		},

		onHidden : function() {
			// call the done handler if provided
			if (this.doneHandler) this.doneHandler(this.selectedValue);

			// deselect selected color
			this.$root.find(".Cell.selected").removeClass("selected");

			// remove any edit rows
			this.$root.find(".editRow").remove();

			this.asContextMenu("onHidden");
		},

		getColorsHTML : function() {
			var menu = this;
			var rowData =  { menu : this };
			var cellData = { menu : this };

			// for each row
			var rows = this.colors.map(function(row, rowIndex) {
				if (!row.forEach) return "";

				// expand cellTemplate for each cell in the row
				rowData.cells = row.map(function(color, columnIndex) {
					if (!color) return "";
					cellData.color = color;
					cellData.index = columnIndex;
					cellData.menu = menu;
					return menu.cellTemplate.expand(cellData);
				}).join("");

				// expand rowTemplate for the row
				return menu.rowTemplate.expand(rowData);
			});

			return rows.join("\n");
		},

	//
	//	custom rows
	//

		// Add a custom row to the color menu.
		// 	Pass the following `properties`:
		//		- `id`			String id of the row.  Useful if you want to manually show/hide/remove the row later.
		//		- `active`		(default:true) Set to false to hide the row temporarily.
		//		- `editable`	(default:true) Set to false to make the row read-only.
		//		- `
		//	`rowId` is the id of the row.  If you specify the same id twice, we'll overwrite the old one.
		//	`colors` is the array of up to 10 colors.  May be null.
		//	`title` is the title.  It should be short.  Pass null for no title.
		//	`save(colors, row)` is a bound function we'll use to save colors as they change.
		//			You will be passed the entire list of colors as it stands.
		//			Colors not set will be null.
		//			If you don't provide a saver, the colors will not persist across page loads.
		//	`update(row)` is the bound function to load the current list of colors.
		//			This is called automatically right before the menu is shown.
		//			Use this to:
		//				- modify the `row.colors` array
		//				- adjust `row.active` (set to to false to hide the row)
		//				- adjust `row.editable` (set to false to make the row read-only)
		//			If you don't provide a updater, the colors will not be changed automatically.
		addCustomRow : function(properties) {
			// clone the properties passed in
			var row = $.extend({}, this.CUSTOM_ROW_DEFAULTS, properties);

			// make sure we have an id and that it's a string
			if (!row.id) 	row.id = "row" + CUSTOM_ROW_SEQUENCE++;
			else			row.id = ""+row.id;

			// remember the row
			this.customRows[row.id] = row;

			// add a template stub for the row to the menu
			row.$root = $(this.customRowTemplate.expand(row));
			this.$root.append(row.$root);

			// if we're currently showing, update now. Otherwise it'll happen automatically on show.
			if (this.isShowing) this.updateCustomRow(row);
		},
		CUSTOM_ROW_SEQUENCE : 1,
		CUSTOM_ROW_DEFAULTS : {
			id			: undefined,
			active 		: true,
			editable	: true,
			title		: undefined,
			colors		: undefined,
			update		: undefined,
			save		: undefined
		},

		updateCustomRow : function(row) {
			if (row.active) {
				var colors = row.colors || "";

				// take an array or a string
				if (typeof colors === "string") colors = row.colors = colors.splitByCommas();

				// expand a title template if we have one set
				var $root = $(this.customRowTemplate.expand(row));
				if (row.title) $root.append(this.customRowTitleTemplate.expand(row));

				// only add as many colors as the regular part of the menu has columns
				for (var column = 0, count = this.colors[0].length; column < count; column++) {
					var color = colors[column], template;

					if (color) 				template = this.customCellTemplate;
					else if (row.editable)	template = this.editableEmptyCellTemplate;
					else					template = this.readOnlyEmptyCellTemplate;

					var columnParams = { column:column, color:color };
					$root.append(template.expand(columnParams));
				}
				row.$root.replaceWith($root);
				row.$root = $root;
			}
			this.toggleCustomRow(row.id, row.active);
		},

		// Show/hide a custom row.
		toggleCustomRow : function(rowId, shouldShow) {
			this.$root.find(".customRow[row='"+rowId+"']").toggle(shouldShow);
		},

		// Completely remove a custom row.
		removeCustomRow : function(rowId) {
			this.$root.find(".customRow[row='"+rowId+"']").remove();
			delete this.cutomRows[rowId];
		},


	//
	//	event handling
	//

		// Click on a normal, non-settable color.
		onColorClicked : function(event, $color) {
			var color = $color.attr("color");
			this.selectedValue = color;
			this.hide();
		},

		// Click on a settable color in a customRow.
		onCustomColorClicked : function(event, $color) {
			var color = $color.attr("color");

			// if the color is a question mark, or the option key is down
			if (color === "?" || UI.keys.ALT) {
				// select the cell in question
				$color.addClass("selected");

				// figure out row/column/etc
				var $row = $color.parents(".customRow");
				var rowId = $row.attr("row");
				var column = $color.attr("column");
				if (color === "?") color = "";

				// make an edit row & stick it after the row in question
				var $editRow = $(this.customEditRowTemplate.expand({id:this.id, rowId:rowId, column:column, color:color}));
				$editRow.insertAfter($row);

				// select the input so they can just start typing
				var $field = $editRow.find("input");
				$field.select();
			} else {
				this.onColorClicked(event, $color);
			}
		},

		get$editRow : function() {
			return this.$root.find(".editRow");
		},

		getEditColor : function() {
			var $row = this.get$editRow();
			var $input = $row.find("input");
			var currentColor = $input.val();
			return Math.validateColor(currentColor);
		},

		onEditColorKeypress : function(event) {
			if (UI.keys.RETURN || UI.keys["NUM-ENTER"]) {
				this.saveCustomColor();
			}
			else if (UI.keys.TAB) {
				this.saveCustomColor();
			}
		},

		onEditColorKeyup : function(event) {
			var $row = this.get$editRow();
			var color = this.getEditColor();

			// disable the ok button if not a valid color
			$row.find(".ok").toggleClass("disabled", !color);

			var $selected = this.$root.find(".selected");
			$selected.css("backgroundColor", color || "transparent");
			$selected.toggleClass("empty", !color);
		},

		saveCustomColor : function() {
			var color = this.getEditColor();
			if (!color) return this.hide();

			var $row = this.get$editRow();
			var rowId = $row.attr("row");
			var column = parseInt($row.attr("column"));
//console.warn(rowId, column, color);

			// get the custom row to save
			var row = this.customRows[rowId];

			// update the colors for the row for next time in case we don't have a saver
			row.colors[column] = color;

			// if the row has a saver, go for it
			if (row.save) {
				row.save(row.colors, row);
			}

			// select that color as the result of the dialog
			this.selectedValue = color;
			this.hide();
		},

	});



	return ColorMenu;
});	// end define("oak/lib/ui/ColorMenu")

