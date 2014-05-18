/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/*
	Editors are panels that allow you to edit a loadable data object.

*/

Module.define("oak/lib/ui/Editor",
"oak/lib/core/Class,oak/lib/ui/Panel,oak/lib/core/Debuggable,oak/lib/ui/ColorMenu",
function(Class, Panel, Debuggable, ColorMenu) {

	var Editor = new Class("Editor", "Panel",
	// instance properties
	{
		// make editors debuggables
		mixins : "Debuggable",

		// set to `true` to debug when we have trouble get()ting/set()ting our data
		debugData : false,

		parts : {
			// elements (inputs, selects, etc) which map directly properties of our data
			$fields				: "## *[field]",

			// visible <input>, <select> and <textarea> fields in the form
			$visibleInputs		: "LIVE:## input[field]:visible,select[field]:visible,textarea[field]:visible",

			// generic toolbar reference, shown/hidden when the editor is shown
			$toolbar			: "##Toolbar",

			// generic save button reference, shown/hidden when our data is changed
			$saveButton			: "##Toolbar .saveButton",

			// generic form header, see "setHeader" below
			$header				: "## .formHeader:first-child",

			// All <select>s in the form will automatically be converted to prettier Selects
			// if `autoStyleSelects` is true.
			$selects			: "## select"
		},

		events : [
			{selector:"## form",			event:"submit",	 	handler:"onSubmitForm", type:"normal"},
			{selector:"## [field]",    		event:"click",	 	handler:"onFieldClicked"},
			{selector:"## [field]",    		event:"change", 	handler:"onFieldChanged"},
			{selector:"## [field]",   		event:"focus", 		handler:"onFieldFocused"},
			{selector:"## [field]",    		event:"blur", 		handler:"onFieldBlurred"},
			{selector:"## [field]",			event:"keypress", 	handler:"onFieldKeyPress"},
			{selector:"## .ColorChip",		event:"click",		handler:"onColorChipClicked"},

			// catch image load errors to show an "errorsrc".
			//	NOTE: the type:normal is necessary for this type of event to work
			{selector:"## img",				event:"error",		handler:"onImageLoadError", type:"normal"},
		],

	//
	//	form attributes
	//

		// if true, we auto-focus on the first focusable field onShown()
		autoFocus : true,

		// Set to the name of a field to focus in automatically.
		// If null, we'll focus in the first field we find.
		autoFocusField : null,

		// if true, we auto-clear our data onHidden()
		autoClear : true,

		// if true, we attempt to auto-save our data onHiding()
		autoSave : false,

		// if true, we watch events on our data element (see setData() )
		watchData : false,

		// if true, all select elements will be made made good looking
		autoStyleSelects : false,

		//keep track of if we've already styled our selects
		selectsStyled : false,

		// ON AN IPAD:  We'll scroll the window to the top when we're focused in a field.
		//				This can correct some position:fixed problems.
		scrollToTopWhenFocused : false,

		// If true, we'll de-focus a <select> after a value is chosen.
		defocusAfterSelecting : false,

	//
	//	meta-info about the various fields:
	//		for each named field, you can have:
	//			- required	: true    						(default is false)
	//			- validator : function(value, fieldInfo)	(throw an error if not valid)
	//							-- see Editor.validators below!
	//
	//
		fieldMap : {},

		// format to output dates for display -- see .getDateDisplayValue()
		dateFormats : [ "object", 	// returns date object
						"iso", 		// ISO 8601 format (see oak/lib/js/Date.js)
						"pretty", 	// "pretty" date (see oak/lib/js/Date.js)
						"relative"	// "relative" date (see oak/lib/js/Date.js)
					  ],
		dateFormat : undefined,		// return the input value without change by default

		// format to output "time" values for display -- see .getTimeDisplayValue()
		timeFormats : [ "hours", "minutes", "seconds", "relative" ],
		timeFormat : undefined,			// return the input value without change by default

		// format to input "time" values for display -- see .getTimeDisplayValue()
		timeInputFormats : [ "hours", "minutes", "seconds" ],
		timeInputFormat : "seconds",	// assume times are expressed in seconds for parsing


	//
	//	view semantics
	//
		onReady : function() {
			// make sure we have a fieldMap, and set each field's 'field' property to the name of the field
			if (!this.fieldMap) this.fieldMap = {};
			for (fieldName in this.fieldMap) {
				this.fieldMap[fieldName].field = fieldName;
			}

			this.asWidget("onReady");
		},

		// Show toolbar and auto-stle selects if necessary.
		onShowingPlugins : [function() {
			for (var fieldName in this.fieldMap) { this.setError(fieldName, null) }
			if (this.$toolbar) this.$toolbar.show();
			if (this.autoStyleSelects) {
				this.styleSelects();
			}
		}],

		// Auto-focus in appropriate field when we're shown.
		onShownPlugins : [function() {
			this.updateEnableif();
			if (this.autoFocus) {
				var focused = false;
				if (this.autoFocusField) {
					focused = this.focusInField(this.autoFocusField);
				}
				if (!focused) this.focusInFirstField();
			}
		}],

		onHidingPlugins : [function() {
			// NOTE: we could get into a bad state with this and validation...
			this.blurFocusedField();

			// check to see if we should save the current data
			if (this.autoSave && this.data && this.data.isDirty) {
				// if our data is set to autoSave, then just save
				var autoSave = this.autoSave;

				// otherwise, if the *editor* specifies a save prompt string
				//	ask the user if they want to save
				if (!autoSave) {
					var promptText = this.getSavePrompt();
					if (promptText) autoSave = confirm(promptText);
				}

				// save if indicated
				if (autoSave) {
					this.save();
				} else {
					if (Editor.debug) console.warn(this.id + ".onHiding(): data is dirty but we're not saving");
				}
			}
		}],

		onHiddenPlugins : [function() {
			if (this.$toolbar) this.$toolbar.hide();
			if (this.autoClear) this.setData(null);
		}],


		// Run through our `field` records and enable/disable any with an `enabled` handler.
		//	enabled arguments:    (fieldName, current field value, our full data object)
		//							called with the Editor as `this`.
		updateEnableif : function() {
			if (!this.fieldMap) return;

			for (fieldName in this.fieldMap) {
				var enabled = this.fieldMap[fieldName].enabled;
				if (!enabled) continue;
				var $field = this.get$field(fieldName);
				try {
					var disabled = !(enabled.apply(this, [fieldName, this.get(fieldName), this.data]));
					$field.attr("disabled", disabled ? "disabled" : null);
				} catch(e) {
					console.warn(this+".updateEnableif(): error evaluating enabled for field '"+fieldName+"'");
				}
			}
		},


		// Style a set of html <select> elements.
		// You can pass either an array of <selects>, or a CSS selector which produces an array of selects.
		// If you pass no arguments, we'll style the $selects set up as parts of this instance.
		styleSelects : function($htmlSelects) {
			if (this.selectsStyled) {
				return;
			}
			this.selectsStyled = true;
			if (!$htmlSelects) $htmlSelects = this.$selects;
			if (typeof $htmlSelects === "string") $htmlSelects = $($htmlSelects);
			for (var i=0; i < $htmlSelects.length; i++) {
				this.styleSelect($($htmlSelects[i]));
			}
		},

		// Style an individual <select> element.
		//	$htmlSelect should be a single <select> wrapped in a jQuery vector.
		SELECT_TEMPLATE : "<div class='selector'>"
							+"<div class='selector-value'><label></label><span class='selector-arrow'></span></div>"
							+"<div class='selector-menu' style='display: none;'></div>"
						+ "</div>",
		SELECT_OPTION_TEMPLATE : "<div class='selector-option' value='{{value}}'>{{label}}</div>",

		styleSelect : function($htmlSelect){
			// set an attribute on the <select> element so we don't style more than once
			if ($htmlSelect.attr("styled")) return;
			$htmlSelect.attr("styled", "yes");

			// get the outer HTML from our template
			var $proxy = $(this.SELECT_TEMPLATE.expand(this));

			// loop through the options on the original select, creating an option in the proxy for each
			var optionsHTML = [];
			var templateHTML = this.SELECT_OPTION_TEMPLATE;
			$htmlSelect.find('option').each(function(){
				var $option = $(this);
				var optionData = { value : $option.attr("value"), label : $option.html() };
				optionsHTML.push(templateHTML.expand(optionData));
			});
			var $menu = $proxy.find(".selector-menu");
			$menu.html(optionsHTML.join("\n"));

			// make the $proxy show the current value of the HTML select
			function showValue(value) {
				if (value === undefined || value == "") value = $htmlSelect.val();
//console.info("changing value of ",$htmlSelect, " proxy:", $proxy," to ",value);

				// unselect currently selected option
				$proxy.find('.selector-selected').removeClass('selector-selected');

				// select the option which should now be selected
				var $option = $proxy.find(".selector-option[value='"+value+"']");
				$option.addClass("selector-selected");

				// show correct value
				$proxy.find(".selector-value label").html($option.html());
			}
			// associate the showValue function directly with the $htmlSelect
			$htmlSelect.data("showValue", showValue);

			// and set up a "valHook" on selects to call their showValue function if defined
			if (!Class.Editor._styleSelectValHookInitialized) {
				Class.Editor._styleSelectValHookInitialized = true;
				$.valHooks.select = {
					set : function(el, value) {
						var showMethod = $(el).data("showValue");
						if (typeof showMethod === "function") showMethod(value);
					}
				}
			}

			// hook up the change event on the original <select> to show the correct value
			$htmlSelect.on("change", showValue);

			// hookup click event for selector-options to select the value in the original <select>
			//	the onChange event above will then show the correct value
			$menu.on("click", ".selector-option", $.proxy(function(event) {
				var value = $(event.target).val();
				$htmlSelect.val(value);

				this.set($htmlSelect.attr('field'), value);
			}, this));

			// hookup click on the display element to show the menu,
			//	and then hide the menu on click in the body (this lets the user click outside the menu to hide it).
			var $display = $proxy.find(".selector-value");
			function showMenu() {
				$menu.show();
				$("body").captureEvent("click", hideMenu);
			}
			function hideMenu() {
				$menu.hide();
				$("body").releaseEvent("click", hideMenu);
			}
			$display.on("click", showMenu);

			// set the initial display value according to the value of the <select>
			showValue();

			// SHOW THE new selector and HIDE the original htmlSelect.
			$htmlSelect.hide().after( $proxy );
		},

	//
	//	load data
	//

		// set our .data property to some object which implements "get" and "set" and "save" semantics
		// and then load the data
		setData : function(data) {
			// ignore if setting to the same thing
			if (data && data === this.data) return;

			if (this.watchData) {
				// make sure our bound event handlers are set up
				if (!this._dataEvents) {
					this._dataEvents = {
						"changed" 		: this.bind("onDataChanged"),
						"reset" 		: this.bind("onDataReset"),
						"saved"   		: this.bind("onDataSaved"),
						"saveError"   	: this.bind("onDataSaveError")
					};
				}

				// ignore dirty/clean events from our data
				if (this.data) {
					$(this.data).off(this._dataEvents);
				}
			}
			this.data = data;

			// watch for dirty/clean events from our data
			if (this.data) {
				if (this.watchData) {
					$(this.data).on(this._dataEvents);
				}
				this.loadData();
			} else {
				this.updateFields();
				this.onDataReset();
			}
		},

		// Load our data, if necessary.
		//	If our data corresponds to the "Loadable" mixin, we'll call its load method
		//	Otherwise we'll go straight to our onDataLoaded() method
		loadData : function() {
			if (!this.data) return;

			// if not loadable, just go right to our "onDataLoaded" routine
			if (!this.data.isLoadable) {
				this.onDataLoaded();
			}
			// if loadable, load it and call our onDataLoaded() back when done
			else {
				this.data.load().done(this.onDataLoaded.bind(this))
								.fail(this.onDataLoadError.bind(this));
			}
		},

		onDataLoaded : function() {
			this.onDataReset();
			this.updateFields();
		},

		onDataLoadError : function() {
			console.error("TODO: implement IssueEditor.onDataLoadError()!");
		},


	//
	//	save data
	//



		// Return a non-empty string to show as a prompt to save data.
		//	Called in editor.onHiding() if editor.autoSave is true
		getSavePrompt : function() {
			return false;
		},


		// Actually save our data right now (if it is dirty).
		// NOTE: this pattern works if the data is a Saveable()
		save : function(force) {
			if (!this.data) 	 return console.warn(this,".save(): no .data to save");
			if (force) {
				if (!this.data.forceSave) return console.warn(this,".save(): this.data has no forceSave() method");
				this.data.forceSave();
			} else {
				if (!this.data.save) return console.warn(this,".save(): this.data has no save() method");
				this.data.save();
			}
		},

		forceSave : function() {
			this.save(true);
		},


		// our data object has just been marked as 'dirty', update our UI
		onDataChanged : function() {
//console.info("onDataChanged", String.getUrlParameters(this.data));
			if (this.$saveButton) this.$saveButton.addClass("dirty");
			// re-broadcast the "changed" event
			$(this).trigger("changed");
		},

		// our data object has just been marked as not 'dirty', update our UI
		onDataReset : function() {
			if (this.$saveButton) this.$saveButton.removeClass("dirty");
			// re-broadcast the "reset" event
			$(this).trigger("reset");
		},

		// our data object has just been saved, update our UI
		onDataSaved : function() {
			if (Editor.debug) console.info("data saved");

			// re-broadcast the "saved" event
			$(this).trigger("saved");
		},

		// our data object has just been saved, update our UI
		onDataSaveError : function() {
			if (Editor.debug) console.warn("error saving data");

			// re-broadcast the "saveError" event
			$(this).trigger("saveError");
		},


	//
	// working with data values from our .data object, which must implement "get" and "set"
	//

		// Get data value for some field.
		get : function(fieldName) {
			// handle derived values specified as functions in the fieldMap
			var fieldInfo = this.getFieldInfo(fieldName);
			if (fieldInfo.getValue) return fieldInfo.getValue.call(this, this.data, fieldInfo);

			if (!this.data) return undefined;
			if (typeof this.data.get == "function") {
				return this.data.get(fieldName);
			} else {
				var value, expression = "value = this.data."+fieldName;
				try {
					eval(expression);
				} catch (e) {
					if (this.debugData) console.debug(this,"Error getting value for field "+fieldName);
				}
				return value;
			}
		},

		// Set data value for some field.
		set : function(fieldName, value, skipDataChangeNotice) {
			if (!this.data) return;

			// handle derived values specified as functions in the fieldMap
			var fieldInfo = this.getFieldInfo(fieldName);
			if (fieldInfo.setValue) {
				value = fieldInfo.setValue.call(this, value, this.data, fieldInfo);
			}
			// handle data with an explicit 'set' function
			else if (typeof this.data.set == "function") {
				value = this.data.set(fieldName, value);
			}
			// handle normal data by just setting fieldName
			else {
				var value, expression = "value = this.data."+fieldName+" = value";
				try {
					eval(expression);
				} catch (e) {
					if (this.debugData) console.debug(this, "Error setting value for field "+fieldName);
				}
			}
			// MOW: NEW:  fire onDataChanged() whenever we set() a value
			if (skipDataChangeNotice != true) this.onDataChanged();
			return value;
		},

		// Set both the internal data value and DOM field value for a particular field.
		sync : function(fieldName, value, skipDataChangeNotice) {
			this.set(fieldName, value, skipDataChangeNotice);
			this.updateFieldValue(fieldName, value);
		},


		// Return the value to display for some field specified by fieldName.
		//	 If we have a method  `editor.getDisplayValue_<fieldName>(value)`, we'll use that,
		//	 otherwise if we have a 'valueMap' we'll use that to transform the value
		//	 otherwise we'll just use `editor.get(fieldName)`.
		getDisplayValue : function(fieldName) {
			var fieldInfo = this.getFieldInfo(fieldName);
			var value = this.get(fieldName);

			// custom method
			var customMethod = fieldInfo.getDisplayValue || this["getDisplayValue_"+fieldName];
			if (customMethod) {
				value = customMethod.call(this, value, fieldInfo);
			}

			// do we have a custom method for outputting the value based on the field type?
			else if (fieldInfo.type) {
				customMethod = this["get"+fieldInfo.type.capitalize()+"DisplayValue"];
				if (customMethod) {
					value = customMethod.call(this, value, fieldInfo);
				}
			}

			// valueMap for transforming internal value to display value
			//	use this, eg, to change a string enum into an icon, etc
			if (fieldInfo.valueMap) {
				value = fieldInfo.valueMap[value];
			}

			return value;
		},

	//
	//	custom display value mungers
	//

		// Return the value to display for a date field.
		getDateDisplayValue : function(value, fieldInfo) {
			var outputFormat = (fieldInfo && fieldInfo.displayFormat ? fieldInfo.displayFormat : this.dateFormat);
//console.warn(fieldInfo.field, value);
			// if no dateFormat specified, just return what we got
			if (value == null || outputFormat === undefined) return value;

			//
			// attempt to parse the value into a date
			var date;
			if (typeof value === "string") {
				date = Date.fromISOString(value);			// returns undefined if not valid
				if (!date) date = Date.fromFloatString(value);	// returns undefined if not valid
			}

			// if we didn't get a valid date, return null (object) or empty string (any other dateFormat)
			if (!date) {
				if (outputFormat === "object") return null;
				return "";
			}

			if (outputFormat === "object")		return date;
			if (outputFormat === "iso")			return date.toISO();
			if (outputFormat === "pretty")		return date.toPrettyDate();
			if (outputFormat === "relative")	return date.toRelativeDate();
			console.warn("Editor.getDateDisplayValue(): format "+outputFormat+" not understood!");
			return "";
		},

		// Return the value to display for a time field.
		getTimeDisplayValue : function(value, fieldInfo) {
			var outputFormat = (fieldInfo && fieldInfo.displayFormat ? fieldInfo.displayFormat : this.timeFormat);

			// if no timeFormat specified, just return what we got
			if (value == null || outputFormat === undefined) return value;

			// parse input value into seconds
			var seconds = value;
			if (typeof seconds === "string") seconds = parseInt(seconds, 10);
			var inputFormat = (fieldInfo && fieldInfo.format ? fieldInfo.format : this.timeInputFormat);
			if (inputFormat === outputFormat) return value;

			if (inputFormat === "minutes") seconds *= 60;
			if (inputFormat === "hours")   seconds *= (60*60);
			if (inputFormat === "days")    seconds *= (60*60*24);

			if (outputFormat === "seconds")		return seconds+"s";
			if (outputFormat === "minutes")		return Math.round(seconds / 60) + "m";
			if (outputFormat === "hours")		return Math.floor(seconds / (60*60)) + "h";
			if (outputFormat === "relative")	return Date.getRelativeTime(seconds);
			console.warn("Editor.getDateDisplayValue(): outputFormat "+outputFormat+" not understood!");
			return "";
		},

		getArrayDisplayValue : function(value, fieldInfo) {
			if (value && value.join) return value.join(", ");
		},

	//
	//	working with fields
	//

		// Return the field info record for a field, specified by name.
		// If you pass an object, we'll assume it's already fieldInfo record and just return it.
		getFieldInfo : function(fieldName) {
			if (typeof fieldName !== "string") return fieldName;

			var fieldInfo = this.fieldMap[fieldName];
			if (!fieldInfo) fieldInfo = this.fieldMap[fieldName] = { field : fieldName };
			return fieldInfo;
		},

		// update our $fields according to the results of getDisplayValue() for the field
		updateFields : function() {
			if (!this.$fields) return;
			this.$fields.each(function(index, field) {
				var $field = $(field);
				var fieldName = $field.attr("field");
				if (!fieldName) return;
				var value = this.getDisplayValue(fieldName);
				var fieldInfo = this.getFieldInfo(fieldName);
				try {
					this.updateFieldValue($field, value);
				} catch (e) {
					console.error(this,".updateFields(): error setting field value for field "+fieldName+" (value=",value,")");
				}
			}.bind(this));
		},

		// Set the display value for a particular field.
		// NOTE: you can pass a jQuery vector corresponding to a particular field,
		//		 or the string name of the field.
		updateFieldValue : function($field, value) {
			$field = this.get$field($field);
			if ($field == null || $field.length === 0) return;

			var tagName = $field.tagName();

			// checkbox
			if (this.isACheckbox($field)) {
				// normalize isChecked to a boolean
				var isChecked = !!value;
				$field.each(function(index,field){field.checked = isChecked});
				return;
			}
			// radio buttons
			else if (this.isARadioButton($field)) {
				// NOTE: $fields will be ALL of the radio buttons in the family here!
				$field.each(function(index, button) {
					var $button = $(button);
					var btnValue = $button.prop("value");
					$button.prop("checked", value == btnValue);
				});
			}
			// normal input, textarea or select
			else if (tagName == "input" || tagName == "select" || tagName == "textarea") {
				$field.val(value);
				return;
			}
			// img -- we set the @src of the image to the value
			else if (tagName == "img") {
				if (value == null) {
					var errorSrc = $field.attr("errorsrc");
					if (errorSrc) 	value = errorSrc;
					else			value = "";
				}
				$field.attr("src", value);
				return;
			}
			// color chip, displays a color
			else if ($field.is(".ColorChip")) {
				if (value != "transparent")	value = value.rgbToHex();
				$field.css("background-color", value);
				var colorClass = "color-" + value.replaceAll("#", "");
				$field.removeClassesStartingWith("color-");
				$field.addClass(colorClass);
				return;
			}
			else if (tagName == "output") {
				var type = $field.attr("type");
				if (type === "date") {
					if (value instanceof Date) {
						$field.html(value.toFloat());
						return;
					}
				}
			}

			// if we get here, there is no special logic for this field type
			// just set the HTML
			$field.html(value);
		},

		onSubmitForm : function(event, $form) {
			event.preventDefault();
		},

		onFieldClicked : function(event, $field) {},

		// An input, textarea or select has changed.
		onFieldChanged : function(event, $field) {
			var fieldName = $field.attr("field");
//console.warn("onFieldChanged",fieldName);
			if (!fieldName) return;
			var value = this.get$fieldValue($field);
			this.set(fieldName, value);	// NOTE: this will trigger our "changed" event
			var fieldInfo = this.getFieldInfo(fieldName);
			if (fieldInfo.onChange) {
				if (typeof fieldInfo.onChange === "string") fieldInfo.onChange = this[fieldInfo.onChange];
				if (typeof fieldInfo.onChange === "function") {
					fieldInfo.onChange.apply(this, [$field, value]);
				}
			}
			$(this).trigger("fieldChanged",[fieldName, value]);

			// de-focus selects if necessary
			if (this.defocusAfterSelecting && $field.tagName() === "select") {
				$field.blur();
			}
		},

		// Given a $field (or the name of a field), return its value
		get$fieldValue : function($field) {
			// de-normalize in case we got $field as a string fieldName
			$field = this.get$field($field);
			var fieldName = $field.attr("field");
			// special case for checkboxes
			if (this.isACheckbox($field)) {
				var isChecked = $field[0].checked;
				// run through the valueMap of field info for that field
				var fieldInfo = this.getFieldInfo(fieldName);
				var valueMap = fieldInfo.valueMap;
				if (valueMap) {
					for (var key in valueMap) {
						if (valueMap[key] === isChecked) return key;
					}
				}
				return isChecked;
			}
			// special case for radio buttons
			if (this.isARadioButton($field)) {
				var $checkedItem = this.$fields.filter("input[type=radio][field='"+fieldName+"']:checked");
				return $checkedItem.val();
			}

			// normal case
			return $field.val();
		},

		isACheckbox : function($field) {
			var element = $field[0];
			return (element != null
				&& element.tagName.toLowerCase() === "input"
				&& (element.getAttribute("type")||"").toLowerCase() === "checkbox");
		},

		isARadioButton : function($field) {
			var element = $field[0];
			return (element != null
				&& element.tagName.toLowerCase() === "input"
				&& (element.getAttribute("type")||"").toLowerCase() === "radio");
		},

		onColorChipClicked : function(event, $field) {
			var fieldName = $field.attr("field");
			var currentColor = this.get(fieldName).rgbToHex();

			var editor = this;
			function setColor(color) {
				if (color) {
					editor.set(fieldName, color);
					editor.updateFieldValue($field, color);
				}
			};

			// if option key is down, prompt for color instead
			if (UI.keys.ALT) {
				UI.prompt("Custom color?", currentColor)
					.done(setColor);
				return;
			}

			if (!this.colorMenu) {
				// Ask UI for a colorMenu which it sets up specially.
				if (UI.getColorMenu) {
					this.colorMenu = UI.getColorMenu();
				}
				// otherwise make one ourself.
				else {
					this.colorMenu = new ColorMenu({
						id : this.id + "ColorMenu",
					}).draw();
				}
			}

			this.colorMenu.showForTarget(this.data, event, [currentColor, setColor]);
		},

		// An input, textarea or select has been focused.
		onFieldFocused : function(event, $field) {
			// NOTE: For iPad, focusing in a field will cause the body to scroll if you've got position:fixed content.
			//		 This leads to all kinds of trouble, so try to disable it.
			if (Browser.is.ipad && this.scrollToTopWhenFocused) {
				Browser.scrollToTop();
			}

			this.$focusField = $field;
			this.get$fieldContainer($field).addClass("focused");
			UI.addClass("fieldFocused");

			// Focus events don't bubble, so pass event up to UI in case it wants to do something generic.
			UI.onFieldFocused(event, $field);
		},

		// An input, textarea or select has been blurred.
		onFieldBlurred : function(event, $field) {
			$field.data('editorTextSelected', false);
			this.$focusField = null;
			this.get$fieldContainer($field).removeClass("focused");
			UI.removeClass("fieldFocused");

			// Blur events don't bubble, so pass event up to UI in case it wants to do something generic.
			UI.onFieldBlurred(event, $field);
		},

		// keypress handling:
		//	- return key should advance to next field in the form (or submit)
		//	- remove validation errors on keypress
		//
		onFieldKeyPress : function(event, $field) {
			var fieldName = $field.attr("field");
			$(this).trigger("keypress", [fieldName, UI.keys]);
			// if enter key, fire custom handler
			if (UI.keys.RETURN) {
				this.onReturnKeyPressed(event, $field);
			} else {
				this.showFieldAsValid($field, null);
			}

			// if editor or field have "changeOnKeyPress" true,
			//	fire a `onFieldChanged()` event
			//	(after a short delay, so the val() of the field will catch up).
			var fieldInfo = this.getFieldInfo(fieldName);
			if (this.changeOnKeyPress || (fieldInfo && fieldInfo.changeOnKeyPress)) {
				setTimeout(function() {
					this.onFieldChanged(event, $field);
				}.bind(this), 0);
			}
		},

		// Return key was pressed:
		//	- if in the last field of the form, attempt to submit
		//	- otherwise advance to next form field
		onReturnKeyPressed : function(event, $field) {
			var index = this.getVisibleFieldIndex($field);
			var input = this.$visibleInputs[index];
			var nextInput = this.$visibleInputs[index+1];

			// if we can't figure out which field we're dealing with, forget it
			if (input == null) return;

			// manually fire the onChange event of the field
			this.onFieldChanged(event, $field);

			// if there's another input to go to, focus in it
			if (nextInput) {
//console.warn("showing", nextInput);
				nextInput.focus();
			}
			// otherwise submit the form
			else {
//console.warn("submitting");
				// if we're showing modally, trigger our "OK" button press
				if (this.showingModally) {
					this.onOK();
				}
				// otherwise just call save immediately
				else {
					this.save();
				}
			}
		},

		// Return the index of a certain <input>, <textarea> or <select> in the list of fields in this form
		getVisibleFieldIndex : function($field) {
			var element, fieldNum = -1;
			while (element = this.$visibleInputs[++fieldNum]) {
				if (element == $field[0]) return fieldNum;
			}
			return -1;
		},

		// We got a 404 loading the @src for an image;
		//	if the image specifies an "errorsrc", show that instead.
		onImageLoadError : function(event, $image) {
			var errorsrc = $image.attr("errorsrc");
			if (errorsrc) $image.attr("src", errorsrc);
		},



		// return jQuery vector for a named field
		get$field : function(fieldName) {
			if (typeof fieldName !== "string") return fieldName;
			return this.$root.find("[field='"+fieldName+"']");
		},

		// get the "xxxContainer" element which is above a field
		get$fieldContainer : function($field) {
			if (typeof $field === "string") $field = this.get$field($field);
			var $parent = $field;
			while ($parent.length) {
				if ($parent[0].className && $parent[0].className.contains("Container")) return $parent;
				if ($parent.hasClass("editor")) return $();
				$parent = $parent.parent();
			}
			return $();
		},

		// Set focus to a particular field.  Pass a field name or $field.
		//	Returns true if we were actually able to focus in the field.
		focusInField : function(fieldName) {
			var $field = (typeof fieldName == "string" ? this.get$field(fieldName) : fieldName);
			// forget it if the field is not visible
			if ($field.length == 0 || !$field.is(":visible")) return false;
			var field = $field[0];
			try {
				if (typeof field.select == "function" && !$field.data('editorTextSelected')) {
					$field.data('editorTextSelected', true);
					field.select();
					return true;
				} else if (typeof field.focus == "function") {
					field.focus();
					return true;
				}
			} catch (e) {}
			return false;
		},

		// Focus in the first focusable field in the form.
		//	Will attempt to do a .select() if possible.
		focusInFirstField : function() {
			for (var i = 0; i < this.$fields.length; i++) {
				if (this.focusInField($(this.$fields[i]))) return;
			}
		},

		// if we're currently focused in a field, save its value
		blurFocusedField : function() {
			// NOTE: we could get into a bad state with this and validation...
			if (this.$focusField) {
				if (Editor.debug) console.info("saving field ",this.$focusField[0]);
				this.onFieldChanged(null, this.$focusField);
				this.$focusField.blur();
				delete this.$focusField;
			}
		},


	//
	//	field validation/error management
	//

		// Given a set of <error> objects from a server <response>, show them in the field
		showServerErrors : function(errors) {
			var firstErrorField = null;

			errors.forEach(function(error) {

				// -1010:  form data validation failed
				if (""+error.code == "-1010") {
					var fieldName = error.desc;
					if (fieldName) {
						this.showFieldAsInvalid(fieldName);
						if (!firstErrorField) firstErrorField = fieldName;
					}
				}
			}, this);

			if (firstErrorField) this.focusInField(firstErrorField);
		},

		// Return the successValue of the editor (when shown in a modal context).
		// If `allFieldsAreValid()` returns false, we'll throw an error.
		getSuccessValue : function() {
			if (this.allFieldsAreValid()) return this.data;
			throw "Some fields invalid";
		},


		// Validate fields of the form, including setting their error states if they fail validation.
		//	Can "massage" field values if necessary by changing editor.data values
		//		(and should also update the form as well).
		//
		//	Returns true if all form values are valid, else false.
		allFieldsAreValid : function(displayErrors) {
			if (displayErrors === undefined) displayErrors = true;

			var $firstInvalidField = null;
			if (this.fieldMap) {
				for (var fieldName in this.fieldMap) {
					var $field = this.get$field(fieldName);
					var fieldInfo = this.fieldMap[fieldName];
					// Default in: fieldName, $field and title values into fieldInfo
					fieldInfo.fieldName = fieldName;
					fieldInfo.$field = $field;
					if (!fieldInfo.title) fieldInfo.title = fieldName.capitalize();
					// value we currently associate with the field
					value = this.get(fieldName);

					// should we trim() the field?
					if (fieldInfo.trim && typeof value == "string") {
						var trimmed = value.trim();
						if (trimmed != value) {
							value = this.set(fieldName, trimmed, true);
							this.updateFieldValue($field, trimmed);
						}
					}

					var error;
					// check required flag
					if (fieldInfo.required && (value == null || value == "")) {
						if (!$firstInvalidField) $firstInvalidField = $field;
						error = fieldInfo.requiredMessage || ("required");
						if (displayErrors) {
							this.showFieldAsInvalid(fieldName, error);
						}
						continue;
					}

					// check requiredIf method
					if (fieldInfo.requiredIf) {
						var isRequired = fieldInfo.requiredIf.apply(this, [value, this.data]);
						if (isRequired && (value == null || value == "")) {
							if (!$firstInvalidField) $firstInvalidField = $field;
							error = fieldInfo.requiredMessage || ("required");
							if (displayErrors) {
								this.showFieldAsInvalid(fieldName, error);
							}
							continue;
						}
					}

					// check validator function
					if (fieldInfo.validator) {
						// denormalize if we specify a 'standard' validator
						if (typeof fieldInfo.validator === "string") {
							fieldInfo.validator = Editor.validators[fieldInfo.validator];
						}
						try {
							passed = fieldInfo.validator.apply(this, [value, fieldInfo, this.data]);
						}
						// failed validation
						catch (error) {
							// see if there's a custom "failed validation" message to show
							if (fieldInfo.validatorMessage) error = fieldInfo.validatorMessage
							if (displayErrors) {
								this.showFieldAsInvalid(fieldName, error);
							}

							if (!$firstInvalidField) $firstInvalidField = $field;
							if (Editor.debug) console.warn("Field failed validation! '", error,"'");
							continue;
						}
					}

					// if we get here, this field is valid so clear its error state
					this.showFieldAsValid(fieldName);
				}
			}
			if ($firstInvalidField) {
				if (displayErrors) {
					this.focusInField($firstInvalidField);
				}
				return false;
			}
			return true;
		},


		// Show a particular field as invalid.
		//	If you pass an errorMessage, that will be displayed as the error text.
		//	If you don't pass one, we'll use:   editor.fieldMap[fieldName].invalidMessage
		showFieldAsInvalid : function(fieldName, errorMessage) {
			var fieldInfo = this.getFieldInfo(fieldName);
			if (!errorMessage) errorMessage = fieldInfo.invalidMessage;
			if (errorMessage) {
				this.setError(fieldName, errorMessage);
			} else {
				console.warn(this.id+".showFieldAsInvalid(",fieldName,"): couldn't find invalidMessage to display");
			}
		},

		// Show a particular field as valid.
		showFieldAsValid : function(fieldName) {
			this.setError(fieldName, null);
		},

		// Show field in 'error' state if error is not empty.
		//	If error is empty, clears error state.
		//	"field" is either a field name or a jQuery vector of the field in question itself.
		setError : function($field, error) {
			if ($field == null) {
				if (Editor.debug) console.warn(".setError(): field not specified");
				return;
			}

			if (typeof $field == "string") {
				var $field = this.get$field($field);
				if ($field.length == 0) {
					if (Editor.debug) console.warn(".setError('",$field,"'): field with that name not found");
					return;
				}
			}
			var showError = (error != null && error != "");

			var $parent = $field.parent();
			var $error = $parent.find(".errorHint");

			$parent.toggleClass("error", showError);
			var $error = $parent.find(".errorHint");
			var $hint = $parent.find(".hint");


			if (!showError) {
				$error.remove();
				$hint.show();

			} else {
				$hint.hide();
				if (!$error.length) {
					$error = $("<label class='errorHint'></label>");
					$parent.append($error);
				}
				$error.html(error);
			}
		},


	//
	//	form header manipulation
	//
		getEditorTitle : function() {
			return "Implement "+this.id+".getEditorTitle() !!!";
		},

		setHeader : function(message, mode) {
			if (!this.$header.length) return console.error("Error: ",this.id," calling setHeader() but form has no .formHeader");
			this.$header.html(message)
						.toggleClass("formError", mode == "error")
						.toggleClass("formInfo", mode == "info");
		},

	},
	// static properties
	{
		// validation functions you can use
		validators : {

			// throw an error if not a well-formed email address
			email : function(value, fieldInfo) {
				var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
				if (!re.test(value)) {
					throw "invalid email address";
				}
			},

			// throw an error if not at least 6 characters long
			password : function(value, fieldInfo) {
				if (!value || value.length < 6) throw "6 or more letters";
				if (value.contains(' ')) throw "No spaces please";
			},

			//throw an error if the date does not meet the format YYYY-MM-DD
			//note: we don't check the validity of the date -- let server handle that bit
			date : function(value, fieldInfo) {
				var re = /^\d{4}-\d{2}-\d{2}$/;
				if (!re.test(value)){
					throw "invalid date";
				}
			},

			integer : function(value, fieldInfo) {
				var re = /^[0-9]+$/;
				if (!re.test(value)){
					throw "must be a number";
				}
			},

			identifier : function(value, fieldInfo) {
				var re = /[^\w\d_$]/;
				if (re.test(value)) {
					throw "must be only letters and numbers, no spaces";
				}
			}
		}
	});

	return Class.Editor;
});	// end define("oak/lib/ui/Editor")

