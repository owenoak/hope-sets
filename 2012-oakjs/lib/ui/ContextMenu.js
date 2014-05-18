/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Context menus.
//
//	Context menus are normal Menus which are bound to a `target` object when they're shown.
//	This allows them to show/hide/modify menu items based on the target's state.
//	Hook up to a target by calling:
//		`yourMenu.showForTarget(someObject, event, [<arguments to pass to show()>])`
//	You will receive a promise which will be resolved with the selected menu item when the menu is cleared.
//
//  NOTE:  Including this file turns on right-click context menu support automatically.
//	Create the menu by inlining it in the page, see 'oak/lib/ui/Menu'.
//	Hook up a context menu to any other html element by adding a 'contextmenu' property to the other element.
//


Module.define("oak/lib/ui/ContextMenu",
"oak/lib/jquery/jquery.extensions,oak/lib/ui/Menu,oak/lib/core/Action,oak/lib/core/OrderedMap",
function($, Menu, Action, OrderedMap) {

	var ContextMenu = new Class("ContextMenu", "Menu",
	// instance properties
	{

		// Will this menu be used as a submenu?
		isASubmenu : Property.BooleanAttribute("issubmenu", false),

		// css class to add to our target when we're displaying
		activeTargetClass : "ContextMenuTarget",

	//
	//	creation/showing/hiding
	//

		onReady : function() {
			this.asMenu("onReady");
			// make our $root a child of the body, so we are above all other things on the page
			$("body").append(this.$root);
		},

		// Override initParts() to convert any <action> elements to their corresponding Actions.
		initParts : function() {
			this.asMenu("initParts");

			// make sure we're defined as a ContextMenu
			this.$root.addClass("ContextMenu");
			// Add Submenu class if necessary
			if (this.isASubmenu) this.$root.addClass("Submenu");

			this.$root.find("action,separator,label").each(function(index, itemElement) {
				var $item = $(itemElement);
				var tagName = $item.tagName();
				if (tagName === "action") {
					var actionId = $item.attr("id");
					var action = Action.get(actionId);
					if (!action) return console.warn(this,".initParts(): can't find action for id '"+actionId+"'");
					this.addItem(action, $item);
				} else if (tagName === "separator") {
					this.addSeparator($item);
				} else {
					this.addLabel($item.html(), $item);
				}
			}.bind(this));
		},

		// When we're about to show, check the "visible", "enabled" and "checked" properties of our menu items.
		onShowing : function() {
			var target = this.target, menu = this, $item, handler;

			// make all of our menuItems aware of our menu
			// TODO: MEMORY LEAK???
			this.$items.each(function() {
				this.menu = menu;
			});

			this.$items.each(function(index, item) {
				// make all of our menuItems aware of our menu
				// TODO: MEMORY LEAK???
				item.menu = menu;

				var $item = $(item);
				// handle menuitems with actionids as Actions
				var action = Action.get(item.getAttribute("actionid"));
				if (action) {
					this._updateItemState(action.id, action.visible, action.enabled, action.checked, action.title, $item);
				}
				// handle individual attributes as necessary (for old-style menus not based on Actions)
				else {
					var visible = true, enabled = true, checked = false;
					handler = item.getAttribute("visible");
					if (handler) visible = safelyEval(item, handler, "visible");

					handler = item.getAttribute("enabled");
					if (handler) enabled = safelyEval(item, handler, "enabled");

					handler = item.getAttribute("checked");
					if (handler) checked = safelyEval(item, handler, "checked");

					this._updateItemState(null, visible, enabled, checked, null, $item);
				}
			}.bind(this));

			// now that we've shown/hidden items, make sure
			//	we don't have separators next to other separators or at the start/end of the menu
			var lastVisibleTag, $lastVisibleItem;
			this.$itemsAndSeparators.each(function(index, item) {
				$item = $(item);
				var tagName = $item.tagName();
				var actionId = $item.attr("actionid");
				var domElementShowing = $item.isDisplayed();

				// if a separator, show/hide based on the last item's state
				if (tagName === "separator") {
					// if there's nothing showing so far, or the last visible thing was a separator, hide this separator
					if (!lastVisibleTag || lastVisibleTag === "separator") {
						if (domElementShowing) this.showItem(actionId, false, $item);
						domElementShowing = false;
					}
					// otherwise the separator should be shown
					else {
						if (!domElementShowing) this.showItem(actionId, true, $item);
						domElementShowing = true;
					}
				}

				if (domElementShowing) {
					lastVisibleTag = tagName;
					$lastVisibleItem = $item;
				}
			}.bind(this));

			// if the last visible item in the list is a separator, hide it
			if ($lastVisibleItem && $lastVisibleItem.tagName() === "separator") {
				this.showItem($lastVisibleItem.attr("actionid"), false, $lastVisibleItem);
			}

			this.asMenu("onShowing");

			// callback to eval stuff and print out lots of debugging if something goes wrong
			function safelyEval(item, scriptlet, type) {
				if (!scriptlet) return true;
				var doit = false;
				try {
					var todo = "doit = !!(" + scriptlet + ")";
					eval(todo);
				} catch (e) {
					console.group("ContextMenu.onShowing(): Error evaluating "+type+":");
					console.error(e);
					console.error("\n   menu:", menu);
					console.error("\n   item: ",item);
					console.error("\n   script: ",scriptlet);
					console.error("\n   target:", target);
					console.groupEnd();
				}
				return doit;
			}
		},

		// Update the state of the item given evaluated booleans for our dynamic properties.
		_updateItemState : function(actionId, visible, enabled, selected, title, $item) {
			// check dynamic visibility against DOM state and call showItem() if there was a change.
			var wasVisible = $item.isDisplayed();
			if (visible !== wasVisible) this.showItem(actionId, visible, $item);

			// skip other processing if the item's not visible!
			if (!visible) return;

			// check current enabled state against DOM state and call enableItem() if there was a change.
			var wasEnabled = !$item.hasClass("disabled");
			if (enabled !== wasEnabled) this.enableItem(actionId, enabled, $item);

			// check current checked state against DOM state and call checkItem() if there was a change.
			var wasSelected = $item.hasClass("checked");
			if (selected !== wasSelected) this.selectItem(actionId, selected, $item);

			// check current title against DOM state and call setItemTitle() if there was a change.
			var oldTitle = $item.html();
			if (title && title !== oldTitle) this.setItemTitle(actionId, title, $item);
		},


		// Show this menu as a submenu of some other menu.
		// Overriding to make sure our target is set to the same target as the otherMenu.
		showAsSubmenuOf : function(otherMenu, $menuItemToShowNear) {
			if (otherMenu) this.setTarget(otherMenu.target);
			this.asMenu("showAsSubmenuOf");
		},


		onShown : function() {
			// Note that we're visible, so we only show one menu at a time.
			ContextMenu.visibleContextMenu = this;

			// bring us above all other objects
			// NOTE: don't want to do this for a slide-down menu...  add a property?
			this.$root.bringToFront();
			this.asMenu("onShown");
		},

		// When we're being hidden, if we s
		onHidden : function() {
			// if we've been bound to a target with `showForTarget()`, resolve the menuPromise
			//	with the `selectedValue` of this menu.
			if (this.menuPromise) {
				var value = this.selectedValue;
				this.menuPromise.resolveWith(this, [this.selectedValue]);
				delete this.selectedValue;
			}
			this.clearTarget();
			ContextMenu.visibleContextMenu = null;
			this.asMenu("onHidden");
		},


	//
	//	add/remove items from the menu
	//

		// Add an action to the end of this menu.
		// `$existingElement` is an optional existing element which is in the position you want the action added.
		addItem : function(action, $existingElement) {
			var $action = $(action.menuItemHTML());
			this._add$itemToEnd($action, $existingElement);
		},

		// Add an always-disabled label to the end of the menu.
		// `title` is the text to show in the label.
		// NOTE: actually creates a new Action() to show the label.
		// Returns the id of the label added.
		addLabel : function(title, $existingElement) {
			var action = ContextMenu.getActionForLabel(title);
			this.addItem(action, $existingElement);
		},

		// Add a separator to the end of this menu.
		// Returns the generated, guaranteed-to-be-unique-on-the-page separator id for the separator.
		// `$existingElement` is an optional existing element which is in the position you want the separator added.
		SEPARATOR_TEMPLATE : "<separator actionid='{{id}}'></separator>",
		addSeparator : function($existingElement) {
			var separatorId = ContextMenu.nextSeparatorId();
			var $separator = this.SEPARATOR_TEMPLATE.expand({id:separatorId});
			this._add$itemToEnd($separator, $existingElement);
			return separatorId;
		},


		// Given an $item for a menuitem, separator, label, etc, add it to the end of our list.
		// If you pass an $existingElement, we'll replace that element instead.
		_add$itemToEnd : function($item, $existingElement) {
			// replace pre-existing element if defined
			if ($existingElement && $existingElement.length) {
				$existingElement.replaceWith($item);
			} else {
				this.$root.append($item);
			}
		},


		// Remove an action or seperator from this menu, specified by action id.
		removeItem : function(actionId) {
			var $item = this.$root.find("actionid=["+actionId+"]");
			$item.remove();
		},

		// Clear all items from this menu.
		clearMenu : function() {
			this.$root.html("");
		},


	//
	//	enable/disable/select/set title for items menubar
	//
		// Show/hide a particular action's menu item.
		// `state` is a boolean -- `true` === show the item.
		// `$item` is a pointer to the DOM element for the menu item.
		// Ideally this will be only called when the state has actually changed.
		showItem : function(actionId, state, $item) {
			$item.toggle(state);
		},

		// Enable/disable a particular action's menu item.
		// `state` is a boolean -- `true` === enable the item.
		// `$item` is a pointer to the DOM element for the menu item.
		// Ideally this will be only called when the state has actually changed.
		enableItem : function(actionId, state, $item) {
			$item.toggleClass("disabled", !state);
		},

		// "select" (eg: check/uncheck) a particular action's menu item.
		// `state` is a boolean -- `true` === select (check) the item.
		// `$item` is a pointer to the DOM element for the menu item.
		// Ideally this will be only called when the state has actually changed.
		selectItem : function(actionId, state, $item) {
			$item.toggleClass("checked", state);
		},

		// Update the title of a menu item to a new title string.
		// `$item` is a pointer to the DOM element for the menu item.
		// Ideally this will be only called when the state has actually changed.
		setItemTitle : function(actionId, newTitle, $item) {
			$item.html(newTitle);
		},


	//
	//	Menu `target`ing: set pointer to the element we're about to affect.
	//
	//	`target` can be a normal element or a jQuery vector.
	//	If `target` is a jQuery vector, we'll add our `activeTargetClass` to it when we're showing.
	//
	//	See "oak/lib/ui/ContextMenu:onContextMenu()"
	//
		// Show as a context menu for some target.
		showForTarget : function(target, event, showArgs) {
			if (this.menuPromise) this.menuPromise.rejectWith(this);

			this.menuPromise = new $.Deferred();
			this.setTarget(target);
			this.showNear(event || target, showArgs);

			return this.menuPromise;
		},

		// Set the menu and menuItem `target` to some object.
		// This allows you to reference the target easily
		setTarget : function(target) {
//console.warn("Showing context menu ",this," for ",target);
//console.info(this.$items);
//console.info(this.$root);
//console.info(this.itemSelector);
//console.info(this.$root.find(".MenuItem"));
			this.target = target;
			this.$root.target = target;
			this.$items.each(function(index, item) {
				item.target = target;
			});
			if (this.activeTargetClass) $(this.target).addClass(this.activeTargetClass);
		},

		// Clear the target for the menu and menuItems.
		// NOTE: called automatically when the menu is hidden.
		clearTarget : function() {
			if (this.activeTargetClass) $(this.target).removeClass(this.activeTargetClass);
			this.target = null;
			delete this.$root.target;
			this.$items.each(function(index, item) {
				delete item.target;
			});
		},


	},

	// class methods
	{

	//
	//	right-click menu support
	//

		// Pointer to the context menu which is currenlty being shown, used so we don't show more than one.
		//	Set up in `onShown`, cleared on `onHidden`.
// TODO: just use UI.activeMenu for this?
		visibleContextMenu : undefined,

		// Registry of selector -> Menu for global context menu lookup
		SELECTOR_REGISTRY : {
			// if something has an explicit 'contextmenu' attribute, use that.
			"[contextmenu]" :  "@contextmenu"
		},

		// hookup context menus to appear for some CSS selector.
		// If you pass a menu, we'll use that as the menu for the matched elements.
		// Otherwise we'll look in the element for a 'contextmenu' attribute,
		//	which we'll assume is the id for the element's menu.
		registerMenuForSelector : function(selector, menu) {
			var existing = ContextMenu.SELECTOR_REGISTRY[selector]
			// if a selector is already set up, log a warning and then override
			if (existing !== undefined) {
				if (existing === menu) return;
				console.warn("ContextMenu.registerMenuForSelector(",selector,",",menu,"): \n"
							+ "  menu ",menu," is already defined for this selector. Overriding with new menu.");
			}
			ContextMenu.SELECTOR_REGISTRY[selector] = menu;
		},

		// Clear a selector->Menu map.
		clearMenuForSelector : function(selector) {
			ContextMenu.SELECTOR_REGISTRY[selector] = null;
		},

		// Context menu was invoked for some element.
		// Navigate up the DOM and find any element which matches one of our selectors;
		//	if we find one, show that menu!  If not, we'll show the standard browser context menu.
		//
		// NOTE: if the option/alt key is down, we'll ALWAYS show the browser context menu.
		// NOTE: this automatically dismisses the visibleContextMenu whether a custom is shown or not.
		onContextMenu : function(event, $target) {
			// Hide the visible context menu if there is one
			if (ContextMenu.visibleContextMenu) ContextMenu.visibleContextMenu.hide();

			// if the option key is down, show the default browser menu
			if (event.altKey) return;

			// walk the DOM and figure the menu for the given event
			if (!$target) $target = $(event.target);
			var menu, selector, REGISTRY = this.SELECTOR_REGISTRY;
			function _findMenuForEvent() {
				while ($target[0] !== document) {
					for (selector in REGISTRY) {
						if ($target.is(selector)) {
							menu = REGISTRY[selector];
							return;
						}
					}
					$target = $target.parent();
				}
			}
			_findMenuForEvent();

			// if the "menu" we found is a string, look up in the UI object
			if (typeof menu === "string") {
				// if the string starts with "@", use the corresponding attribute of the target
				if (menu.startsWith("@")) menu = $target.attr(menu.substr(1));
				menu = UI[menu];
			}

			if (!menu) {
		//		console.warn("ContextMenu.onContextMenu(",arguments,"): no menu found");
				return;
			}

			menu.showForTarget($target, event);
			event.stop();
		},

		SEPARATOR_ID_SEQUENCE : 0,
		nextSeparatorId : function() {
			return "SEPARATOR_" + ContextMenu.SEPARATOR_ID_SEQUENCE++;
		},

		LABEL_ID_SEQUENCE : 0,
		nextLabelId : function() {
			return "LABEL_" + ContextMenu.LABEL_ID_SEQUENCE++;
		},

		// Return an action we can use as a label.
		// NOTE: we re-use actions with the same label text!
		getActionForLabel : function(labelText) {
			var actionId = "_MENU_LABEL_"+labelText;
			var action = Action.get(actionId);
			if (!action) {
				action = new Action({
					id 			: actionId,
					title		: labelText,
					enabled		: false
				});
			}
			return action;
		}

	});

	// Hook up a global 'contextmenu' event on the document to check for menus to show
	$(document).on("contextmenu", ContextMenu.onContextMenu.bind(ContextMenu));

	return ContextMenu;
});	// end define("oak/lib/ui/ContextMenu")

