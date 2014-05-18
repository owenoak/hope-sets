/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Top-level menus.
//
//	These are AppMenus which will be added to an app-level "menu bar", much like a desktop app.
//	If we're in "NativeApp" mode (eg:  `Browser.is.nativeapp === true`), we'll "bridge" the items
//	to native menubars in the app.
//


Module.define("oak/lib/ui/AppMenu",
"oak/lib/core/Class,oak/lib/ui/ContextMenu,oak/lib/core/Action,oak/lib/ui/KeyMap,oak/lib/core/IndexedList",
function(Class, ContextMenu, Action, KeyMap, IndexedList) {

	var AppMenu = new Class("AppMenu", "ContextMenu",
	// instance properties
	{
		// Global id of the menu, used in the native bridge to identify this menu.
		id : undefined,

		// Title of the menu as it should appear in the top level menu.
		// NOTE: may not be set for submenus.
		title : undefined,

		// Will this menu be used as a top-level menu?
		inMenuBar : Property.BooleanAttribute("inMenuBar", false),

		// For menu bar menus, conditional expression which says whether or not
		//	the menu button should be currently shown.  Default is to always show.
		showMenuIf : Property.BooleanExpression({value:true}),

		// Pointer to the DOM element for our menu bar button if `inMenuBar === true`.
		// Created in `addToMenuBar()` if not already defined.
		$menuBarButton : undefined,

		// set to true to show html menus when running in native app for debugging menus
		debugShowHtmlMenusOnNative : false,


		// Our visible actions which have shortcuts defined, for use in KeyMaps.
		actionsWithShortcuts : Property.Getter(function() {
			if (!this.showMenuIf) return [];
			return this._actionsWithShortcuts.filter(function(action){return action.visible});
		}, {enumerable:false}),
		_actionsWithShortcuts : [],

	//
	//	top-level menu bar manipulation
	//


		// Register this menu with the native bridge after initializing properties.
		initParts : function() {
			this._actionsWithShortcuts = [];

			this.$root.addClass("AppMenu");		// TODO: AppMenu ???
			if (this.inMenuBar) this.$root.addClass("inMenuBar");

			// Register with native app BEFORE initializing items.
			// Otherwise the items won't have anywhere to go.
			if (Browser.is.nativeapp) {
				NativeApp.createMenu({
					menuId			: this.id,
					title			: this.title,
					isAppMenu 		: (this.id === "GlobalAppMenu"),
					onShowingScript : "UI."+this.id+".onShowing();",
				});
			}

			// contextMenu.initParts() will convert <action> and <separators> to JS objects
			//	and will automatically register with the menu
			this.asContextMenu("initParts");

			AppMenu.register(this);

			// always create a $menuBarButton, even on native, as we use it to track current state
			this.$menuBarButton = $(this.MENU_BAR_BUTTON_HTML.expand(this));

			if (this.inMenuBar) this.addToMenuBar();
		},

		// Override destroy to tell the native app the menu is a goner!
		destroy : function() {
			this.asContextMenu("destroy");
			if (Browser.is.nativeapp) {
				// NativeApp.destroyMenu(this.id);
			}
		},

		// Add this item to the top-level menubar.
		MENU_BAR_BUTTON_HTML : "<button class='AppMenuButton' menu='{{id}}' style='display:none'>{{title}}</button>",
		addToMenuBar : function() {
			if (this.isASubmenu) return;
			if (Browser.is.nativeapp) NativeApp.addToMenuBar(this.id);

			// add the button to the menu bar
			this.addButtonToMenuBar();
		},

		// Add our $menuBarButton to the global menu bar.
		// NOTE: we do NOT do this on native.
		// Broken out because it may be called from two places.
		addButtonToMenuBar : function() {
			if (this.isASubmenu) return;

			// only append the $menuBarButton if we're not on native app
			if (!Browser.is.nativeapp || this.debugShowHtmlMenusOnNative) {
				// NOTE: we may be called before UI.$menuBar has been initialized
				//		 but don't owrry, we'll be called again in `UI.onReady()`
				if (UI.$menuBar) UI.$menuBar.append(this.$menuBarButton);
			}
		},

		// Remove this menu permanently from the menubar.
		removeFromMenuBar : function() {
			if (Browser.is.nativeapp) {
				NativeApp.removeFromMenuBar(this.id);
			} else {
				if (this.$menuBarButton) this.$menuBarButton.detach();
			}
		},

		// Hide this menu in the top-level menubar.
		// `state` is a boolean -- `true` === show the menu.
		showInMenuBar : function(state) {
			if (this.isASubmenu) return;

			// always update state of $menuBarButton
			this.$menuBarButton.toggle(state);

			if (Browser.is.nativeapp) {
				NativeApp.showInMenuBar(this.id, state);
			}
		},

	//
	//	add/remove items
	//
		// Add an action to the end of this menu.
		// `action` is an instance of Action().
		addItem : function(action) {
			this.asContextMenu("addItem");

			// add to the list of our actions for key handling if action has shortcuts
			var shortcuts = action.shortcuts;
			if (shortcuts) 	this._actionsWithShortcuts.append(action);

			if (Browser.is.nativeapp) {
				if (shortcuts) shortcuts = shortcuts[0].join(" ");
				NativeApp.addItemToMenu({
					menuId 			: this.id,
					itemId 			: action.id,
					title 			: action.title,
					keys			: shortcuts,
					submenuId		: action.submenu,
					actionScript	: "Action.fire('"+action.id+"');",
					enabled			: action.enabled,
					nativeAction	: action.nativeAction,
				});
			}
		},

		// Add a separator to the end of this menu.
		addSeparator : function() {
			var separatorId = this.asContextMenu("addSeparator");
			if (Browser.is.nativeapp) {
				NativeApp.addItemToMenu({
					menuId		: this.id,
					itemId		: separatorId,
					separator 	: true
				});
			}
		},

		// Remove an action or seperator from this menu permanently, specified by action id.
		removeItem : function(actionId) {
			this.asContextMenu("removeItem");
			if (Browser.is.nativeapp) {
//				NativeApp.removeItem(this.id, actionId, ...);
			}
		},

		// Permanently clear all items from this menu.
		clearMenu : function() {
			this.asContextMenu("clearMenu");
			if (Browser.is.nativeapp) {
				NativeApp.clearMenu(this.id);
			}
		},


	//
	//	enable/disable/select/set title for items menubar
	//
		// Show/hide a particular action's menu item.
		// `state` is a boolean -- `true` === show the item.
		// Ideally this will be only called when the state has actually changed.
		showItem : function(actionId, state) {
			this.asContextMenu("showItem");
			if (Browser.is.nativeapp) {
				NativeApp.showItem(this.id, actionId, state);
			}
		},

		// Enable/disable a particular action's menu item.
		// `state` is a boolean -- `true` === enable the item.
		// Ideally this will be only called when the state has actually changed.
		enableItem : function(actionId, state) {
			this.asContextMenu("enableItem");
			if (Browser.is.nativeapp) {
				NativeApp.enableItem(this.id, actionId, state);
			}
		},

		// "select" (eg: check/uncheck) a particular action's menu item.
		// `state` is a boolean -- `true` === select (check) the item.
		// Ideally this will be only called when the state has actually changed.
		selectItem : function(actionId, state) {
			this.asContextMenu("selectItem");
			if (Browser.is.nativeapp) {
				NativeApp.selectItem(this.id, actionId, state);
			}
		},

		// Update the title of a menu item to a new title string.
		// Ideally this will be only called when the state has actually changed.
		setItemTitle : function(actionId, newTitle) {
			this.asContextMenu("setItemTitle");
			if (Browser.is.nativeapp) {
				NativeApp.setItemTitle(this.id, actionId, newTitle);
			}
		},


	}, 	// end instance menus

	// begin class methods
	{

// TODO: convert to Uniquify
		// Registry of top-app menus we know about, indexed by id.
		MENU_BAR_REGISTRY : new IndexedList("id"),

		// Register this menu globally.
		register : function(menu) {
			AppMenu.MENU_BAR_REGISTRY.add(menu);
		},

		// Return a menu specified by id.
		// Returns undefined if no such menu.
		get : function(id) {
			return AppMenu.MENU_BAR_REGISTRY.MAP[id];
		},

		// Is a particualar menu visible?
		isVisible : function(id) {
			var menu = this.get(id);
			return (menu ? menu.showMenuIf : false);
		},

		// Return the list of visible menus, including submenus.
		visibleMenus : Property.Getter(function() {
			return AppMenu.MENU_BAR_REGISTRY.filter(function(menu) {
				return menu.showMenuIf;
			});
		}),

		// Update visibility of top-level menus based on current UI state.
		// You must manually call this when something changes which might affect this state.
		updateMenuBar : function() {
			return AppMenu.MENU_BAR_REGISTRY.forEach(function(menu) {
				menu.showInMenuBar(menu.showMenuIf);
			});
		},

		// Add all menu bar buttons to our UI.$menubar in the order in which they were declared.
		addMenuBarButtons : function() {
			AppMenu.MENU_BAR_REGISTRY.forEach(function(menu) {
				menu.addButtonToMenuBar();
			});
		},

		// Permanently remove all menus from the menu bar (and, on native, clears ALL AppMenus).
		destroyAllMenus : function() {
			// Remove from menubar and destroy the widgets.
			AppMenu.MENU_BAR_REGISTRY.forEach(function(menu) {
				menu.removeFromMenuBar();
				menu.destroy();
			});

			if (Browser.is.nativeapp) {
				NativeApp.destroyAllMenus();
			}
		},

		// Initialize global key handling for all visible menus.
		// NOTE: if a modal dialog is open, all menubar actions are disabled.
		initGlobalKeyHandling : function() {
			// Create a keyMap which dynamically returns shortcut'd actions for all visible menus.
			AppMenu.keyMap = new KeyMap(AppMenu.getActiveActions, AppMenu);
			UI.addKeyMap(AppMenu.keyMap);
		},

		// Return the list of actions with shortcuts for all visible menus.
		// NOTE: if a modal dialog is open, all menubar actions are disabled.
		getActiveActions : function() {
			if (ModalStack.length > 0) return [];

			// start with the actions with shortcuts from all visible menus
//console.info(AppMenu.visibleMenus.getProperty("id"));
			var actions = AppMenu.visibleMenus.getProperty("actionsWithShortcuts").flatten();
//console.warn(actions.getProperty("id"));
			return actions;
		},


	});	// end new Class("AppMenu")

	return AppMenu;
});	// end define("oak/lib/ui/AppMenu")

