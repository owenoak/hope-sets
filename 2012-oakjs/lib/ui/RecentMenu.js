/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Recent Menu
//
//	Maintains a list of "recent" items of a given type and displays that as a menu.
//
//	TODO: keep items as an array of objects so we can append the action to that and not have to maintain the registry,
//			then just implement load() and save() for key/title pairs.
//


Module.define("oak/lib/ui/RecentMenu",
"oak/lib/ui/AppMenu,oak/lib/core/Action",
function(AppMenu, Action) {

	var RecentMenu = new Class("RecentMenu", "AppMenu",
	// instance properties
	{
		// id of your menu, will be available as `UI.<id>` after `initialize()`.
		id : undefined,

		// We're a sub-menu
		isASubmenu : true,

		// max # of recent items to show
		recentCount : 20,

		// Should we add a 'clear' item to the menu?
		shouldAddClearItem : true,

		// Label for the "clear" item (only used i `shouldAddClearItem` is true).
		clearItemLabel : "Clear menu",

		// message to show if there are no recent items
		noRecentsLabel : "(nothing to show)",

		// Return true if the item should be show as selected when we show the menu.
		// `recent` will be non-null and has at least `{key, value}`.
		// Override or just leave this alone to not check anything.
		recentIsSelected : function(recent) {
			return false;
		},

		// Return `true` if the specified recent item is currently valid, else `false`.
		// `recent` will be non-null and has at least `{key, value}`.
		// Return false if the item specified by `recent.key` should be removed from the list.
		recentIsValid : function(recent) {
			return true;
		},

		// Sort items for display (default is no sorting).
		// `recents` is a CLONE of our recents array, will be non-null, and each item will have at least `{key, value}`.
		// NOTE: you can modify this array in place or return a new array.
		// NOTE: in returned array array, you can add:
		//			"-" 			to represent a separator
		//			"other text"	to represent a label
		sortRecentsForDisplay : function(recents) {
			return recents;
		},

		// A recent item was clicked -- do something!
		// `recent` will be non-null and has at least `{key, value}`.
		onRecentClicked : function(recent) {
			console.warn(this,".onRecentClicked(",recent.key,"): override onRecentClicked() to do something!");
		},

	//
	//	loading/saving items into localstorage as preferences
	//

		loadRecents : function() {
			if (this.recents) return this.recents;
			this.recents = (this.preference("recents") || []);
		},

		// Remember our current set of recent items as a preference.
		rememberRecents : function() {
			// clone just the key+title for each item
			var clone = [];
			this.recents.forEach(function(recent, index) {
				clone[index] = {key:recent.key, title:recent.title};
			});
			// save in localStorage
			this.preference("recents", clone);
		},

	//
	//	widget lifecycle/drawing semantics
	//
		onReady : function() {
			this.loadRecents();
			this.asAppMenu("onReady");
		},

		// When we're about to show, re-build menu items for the current recents.
		onShowing : function() {
			// remove no-longer-valid recents
			var recents = this.validRecents;

			// now do menu-specific sorting if desired.  This may return a new array.
			recents = this.sortRecentsForDisplay(recents.clone());

			// clear all menu items from the list as we'll re-build below.
			this.clearMenu();

			var html = [];
			if (!recents || recents.length === 0) {
				this.addLabel(this.noItemsLabel);
			} else {
				var i = -1,	recent;
				while ((recent = recents[++i])) {
					if (typeof recent === "string") {
						// separators start with "-"
						if (recent.charAt(0) === "-") {
							this.addSeparator();
						}
						// otherwise it's a label
						else {
							this.addLabel(recent);
						}
					}
					// normal menu item
					else {
						// create an action for the item if necessary
						if (!recent.action) {
							var actionId = this.id+"-"+recent.key;
							var action = Action.get(actionId);
							if (!action) {
								action = new Action({
									id			: actionId,
									title		: recent.title,
									handler 	: this.onRecentClicked.bind(this, recent),
									checkable 	: true,
									checked		: this.recentIsSelected.bind(this, recent)
								});
							}
							recent.action = action;
						}
						this.addItem(recent.action);
					}
				}

				if (this.shouldAddClearItem) {
					if (!this._clearItemAction) {
						this._clearItemAction = new Action({
							id  		: this.id+"--clearRecents",
							title		: this.clearItemLabel,
							handler 	: this.bind("clearRecents")
						});
					}
					this.addSeparator();
					this.addItem(this._clearItemAction);
				}
			}
			this.asAppMenu("onShowing");
		},

	//
	//	recent item management semantics -- unlikely you'll need to override the below
	//
		// If we already have a recent which corresponds to the key, return it.
		// If not, make one and return it.
		findRecent : function(key) {
			var i = -1, recent;
			while ((recent = this.recents[++i])) {
				if (recent.key === key) return recent;
			}
		},

		// Return true if we have items to show.
		// You can use this in an `enabled` as `enabled="<MENU>.hasRecents"`
		hasRecents : Property.Getter(function() {
			return (this.validRecents.length > 0);
		}),


		// Clear the list of recent items.
		clearRecents : function() {
			this.recents = [];
			this.rememberRecents();
		},

		// Add an item to the list of recents.
		// Override if you want to get clever, eg: pass in an Object and have it translate to a key/title.
		addRecent : function(key, title) {
			if (!title) title = key;
			var recent = this.findRecent(key);

			if (recent) {
				// update the title
				recent.title = title;
			} else {
				recent = {key:key, title:title};
			}

			// make sure the recent is at the top of the list
			this.recents.remove(recent);
			this.recents.prepend(recent);

			// limit to our recentCount
			if (this.recents.length >= this.recentCount) {
				this.recents.splice(this.recentCount, 1000);
			}

			// update the list
			this.rememberRecents();
		},

		// Remove an item from the list of recents.
		// All items with the `key` will be removed, no matter the title.
		removeRecent : function(key) {
			var recent = this.findRecent(key);
			if (recent) {
				this.recents.remove(recent);
				// update the saved list.
				this.rememberRecents();
			}
		},

		// Filter items and update our `recents` as necessary.
		// Returns the list of valid items.
		validRecents : Property.Getter(function() {
			if (!this.recents) return [];

			// iterate backwards to make enumeration easier
			var startLength = this.recents.length,
				i = startLength,
				recent
			;

			while ((recent = this.recents[--i])) {
				if (!this.recentIsValid(recent)) {
					this.recents.splice(i, 1);
				}
			}

			// if there was a change, update the saved list.
			if (this.recents.length !== startLength) this.rememberRecents();
			return this.recents;
		}),

	});

	return RecentMenu;
});	// end define("oak/lib/ui/RecentMenu")

