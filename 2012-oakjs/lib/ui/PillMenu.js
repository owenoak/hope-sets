/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/* Menu widget which hooks up to a "pill" field in an editor.  */


Module.define("oak/lib/ui/PillMenu", "oak/lib/core/Class,oak/lib/ui/Menu,oak/lib/core/OrderedMap", function (Class, Menu, OrderedMap) {

	new Class("PillMenu", Menu, {
		// no visual effect
		effect 	: "none",

		// Always show on top of everything else.
		bringToFront : true,

		// REQUIRED: id or pointer to the Editor object we interact with
		editor : null,

		// REQUIRED: name of the field we get our value from
		field : null,

		// delimiter between items in the field value (for splitting string value)
		itemDelimiter : ",",

		// if true, we save the value as a string when putting back into the editor
		saveAsString : true,

		// if true, we automatically hide the menu when a ".Pill" child is clicked
		autoHide : false,

		// automatically hide when the mouse is clicked outside of us when we're shown
		hideOnOutsideClick : true,

		events : [
			// any child with a "Pill" class will automatically hide the menu selected
			{ selector:"## .Pill", event:"mouseup", handler:"onPillUp" },
		],

		// Pop up at the bottom left of the field
		NEAR_ANCHOR : "bottom left",

		// We're 'enabled' if our $field doesn't have a "disabled" attribute.
		enabled : Property.Getter(function() {
			if (this.$field) return !this.$field.attr("disabled");
			return true;
		}),

		onReady : function() {
			// attach to our editor
			if (typeof this.editor === "string") this.editor = UI[this.editor];
			if (!this.editor) return console.warn(this,".onReady(): couldn't find editor!");

			// attach to our field
			this.$field = this.editor.$root.find("[field='"+this.field+"']");
			if (!this.$field.length) return console.warn(this,".onReady(): couldn't find field "+this.field);

			// have the editor get the field value from us
			this.editor["getDisplayValue_"+this.field] = (function() {
				return this.getFieldDisplayValue();
			}).bind(this);

			// bind click events on the pill to call us
			this.editor.addEventDescriptor({
					selector : "[field='"+this.field+"'] .Pill",
					event	 : "mouseup",
					handler	 : "onPillUp",
					scope	 : this
				});

			// bind click events on the pill to call us
			this.editor.addEventDescriptor({
					selector : "[field='"+this.field+"']",
					event	 : "mouseup",
					handler	 : "onFieldUp",
					scope	 : this
				});
		},

		updateContents : function() {
			this.asWidget("updateContents");
			this.updateMenuHTML();
		},

	//
	//	you MUST override these in your subclass
	//
		// REQUIRED:  	Return the list of keys for the menu item
		//				This can be a simple list of keys for a one-dimensional list,
		//				 or an OrderedMap of nested keys for a 2-dimensional list.
		getKeys : function() {
			return "YOU MUST OVERRIDE PillMenu.getKeys()";
		},

		// STRONGLY SUGGESTED: override this and return your deprecated key: value pairs
		getDeprecatedKeys : function() {
			return {};
		},

		// REQUIRED:  return the title for a given key from this.getKeys()
		getTitleForKey : function(key, closeable) {
			return "YOU MUST OVERRIDE PillMenu.getTitleForKey()";
		},

		// STRONGLY SUGGESTED:  return value to show if the field is empty
		getEmptyFieldValueHTML : function() {
			return "&nbsp;";
		},

	//
	//	getting/setting value from editor
	//


		// get the current value from our editor as an array
		getFieldValue : function() {
			var value = this.editor.get(this.field);
			if (!value) value = [];
			if (typeof value === "string") value = value.split(this.itemDelimiter);
			return value;
		},

		// set the current value in our editor
		setFieldValue : function(newValue) {
			if (this.saveAsString && newValue instanceof Array) newValue = newValue.join(this.itemDelimiter);
			this.editor.set(this.field, newValue);
			this.onValueChanged();
		},


		toggleKey : function(key) {
			var value = this.getFieldValue();
			if (value.contains(key)) 	this.removeKey(key);
			else						this.addKey(key);
		},

		addKey : function(key) {
			var value = this.getFieldValue();
			if (value.contains(key)) return;
			value.push(key);
			this.setFieldValue(value);
			this.updateLayout();
		},

		removeKey : function(key) {
			var value = this.getFieldValue();
			if (!value.contains(key)) return;
			value.remove(key);
			this.setFieldValue(value);
			this.updateLayout();
		},



	//
	//	drawing
	//



		// return the current value as a set of pills to be displayed
		getFieldDisplayValue : function() {
			var value = this.getFieldValue();
			if (value == null || value.length == 0) return this.getEmptyFieldValueHTML();
			return this.getPillsHTML(value, null, true);
		},

		// update the value of the display when it's changed
		onValueChanged : function() {
			this.updateFieldHTML();
			this.updateMenuHTML();
		},

		updateFieldHTML : function() {
			this.$field.html(this.getFieldDisplayValue());
		},

		updateMenuHTML : function() {
			var html = this.getPillsHTML(this.getKeys(), this.getFieldValue(), false);
			this.$root.html(html);
		},

		getPillsHTML : function(keys, selected, closeable) {
			if (typeof selected === "string") selected = selected.split(this.itemDelimiter);
			var html = [];
			var deprecatedKeys = this.getDeprecatedKeys();

// TODO: there's quite a bit of duplication in the below, make it DRY.
			// If we were handed an OrderedMap, we've got a nested data structure:
			//	 the first level is a set of groups, the second level is items in each group.
			if (keys instanceof OrderedMap) {
				keys.forEach(function(value, key) {
					var title = this.getTitleForKey(key, closeable);
					html.push("<span class='PillGroup' key='"+key+"' title='"+title+"'>");

					var subKeys = keys[key];
					//add group if group has no keys
					if (subKeys.length === 0) {
						var isShowing = (selected && selected.contains(key));
						var deprecated = (key in deprecatedKeys);
						html.push(this.makePill(key, title, isShowing, !!closeable, deprecated));
					//add all sub keys if group has > 1 subkey
					} else {
						subKeys.forEach(function(subKey) {
							var isShowing = (selected && selected.contains(subKey));
							var title = this.getTitleForKey(subKey, closeable);
							var deprecated = (subKey in deprecatedKeys);
							html.push(this.makePill(subKey, title, isShowing, !!closeable, deprecated));
						}, this);
					}
					html.push("</span>");// end PillGroup
				}, this);

			}
			// simple list of values
			else {
				keys.forEach(function(key) {
					var title = this.getTitleForKey(key, closeable);
					var isShowing = (selected && selected.contains(key));
					var deprecated = (key in deprecatedKeys);
					html.push(this.makePill(key, title, isShowing, !!closeable, deprecated));
				}, this);
			}
			return html.join("");
		},

		makePill : function (key, title, isShowing, closeable, deprecated) {
			var className = "Pill";
			if (isShowing) className += " disabled";
			if (closeable) className += " closeable";
			if (deprecated) className += " deprecated";

			return "<span class='"+ className + "' key='"+key+"' title='" + key + "'>"
							+ title
					+ "</span>";
		},

	//
	//	event handling
	//

		// When mouse goes up in any pull, toggle the key for that pill.
		onPillUp : function(event, $item) {
			event.stop();

			if (!this.enabled) return;
			var key = $item.attr("key");
			this.toggleKey(key);
			this.onValueChanged();
		},

		// When mouse goes up in the field background, show the menu
		onFieldUp : function(event, $field) {
			event.stop();
			if (!this.enabled) return;
			setTimeout(function() {
				if (this.isShowing) this.hide();
				else				this.showNear($field);
			}.bind(this), 0);
		}



	});	// end new Class("PillMenu")

	return Class.PillMenu;
});	// end define("oak/lib/ui/PillMenu")
