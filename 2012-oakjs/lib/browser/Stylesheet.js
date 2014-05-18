/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/*
	Manipulate browser stylesheets.
 */


Module.define("oak/lib/browser/Stylesheet",
"oak/lib/core/Class",
function(Class)
{

	var Stylesheet = new Class("Stylesheet", {

		// Initialize with a stylesheet element.
		init : function(name, stylesheetElement) {
			this.name = name;
				this.element = stylesheetElement;
		},


		// Reload this stylesheet.
		reload : function() {
			var href = this.element.href;
			if (!href) return console.warn("Stylesheet ",this," has no href!  can't reload");

			// strip off old timestamp if there is one
			href = href.replace(/[&\?]?reload=\d+/, "");
			// add new timstamp
			href += (href.contains("?") ? "&" : "?") + "reload=" + Date.now();

			try {
				// update the href of our ownerNode -- this will do the reload.
				this.element.ownerNode.href = href;

				// reset the element since updating the href nukes it
				this.element = Stylesheet.getElementByName(this.name);
			} catch (e) {
				window.sheet = this;
				console.warn("Couldn't reload stylesheet", this.element);
			}
		},


		rules : Property.Getter(function() {
			return this.element.cssRules;
		}),

		// Return the first CSSRule for a specific selector.
		// Returns `undefined` if nothing found.
		indexOf : function(selector, startIndex) {
			selector = selector.toLowerCase();

			var i = (startIndex || 0), rule;
			while (rule = this.rules[i]) {
				if (rule.selectorText == selector) return i;
				i++;
			}
			return -1;
		},

		// Return the first rule for a specific selector.
		getRule : function(selector, startIndex) {
			var index = this.indexOf(selector, startIndex);
			if (index != -1) return this.rules[index];
		},

		// Delete all rules with a specific selector.
		remove : function(selector) {
			for (var index = 0; index = this.getRule(selector); index != -1) {
				this.element.deleteRule(index);
			}
		},

		// Insert a rule at the end of the stylesheet with a given selector and rules string.
		insert : function(selector, rules) {
			this.element.insertRule(selector + " { " + rules + " } ", this.rules.length);
		},

		// Update an existing rule (deletes old instances with the same selector, then adds the rule).
		update : function(selector, rules) {
			this.remove(selector);
			this.insert(selector, rules);
		}


	},
	// static methods
	{

		// Map of known stylesheets.
		MAP : {},

		// Return a linked stylesheet specified by name.
		// NOTE: we'll return the same stylesheet over and over if you specify the first name.
		get : function(sheetName) {
			// ALWAYS re-select the element, as it can get nuked.
			var element = this.getElementByName(sheetName), sheet;

			if (!element) {
				console.warn("Stylesheet.get(",sheetName,"): no stylesheet found");
				return undefined;
			}

			// if we already have one, update its element and return that
			if (this.MAP[sheetName]) {
				sheet = this.MAP[sheetName];
				sheet.element = element;
				return sheet;
			}

			// convert to one of our JS stylesheet objects.
			var sheet = new Stylesheet(sheetName, element);
			// register for next time
			Stylesheet.MAP[sheetName] = sheet;
			// and return it.
			return sheet;
		},

		// Search through all of the document stylesheets,
		//	and return the first one whose name contains the `sheetName` passed in.
		getElementByName : function(sheetName) {
			var element, index = -1, sheets = document.styleSheets;
			while ((element = sheets[++index])) {
				var href = element.href;
//				console.warn(element, href);
				if (href && href.contains(sheetName)) return element;
			}
		},

		// Reload a stylesheet, specified by name.
		reload : function(sheetName) {
			var sheet = this.get(sheetName);
			if (sheet) sheet.reload();
		}


	});	// end new Class("Stylesheet")

	return Stylesheet;

});	// end define("oak/lib/browser/Stylesheet")
