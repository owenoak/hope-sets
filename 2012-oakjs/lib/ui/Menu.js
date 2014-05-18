/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Simple menu widgets
//
//	Create a Menu by inlining html for the menu item in your page somewhere:
//		<widget id="MyMenu" type="Menu" class="Menu" style="display:none">
//				<div class="MenuItem" onclick="doSomething()">Do Something</div>
//				<div class="MenuItem" onclick="doSomethingElse()">Do Something Else</div>
//		</widget>
//
//	This will initialize the Menu object autmatically, you can access it as:
//		UI.MyMenu
//

// TODO:  BASE ON "Poppable"


Module.define("oak/lib/ui/Menu",
"oak/lib/core/Class,oak/lib/ui/Widget,oak/lib/ui/KeyMap,oak/lib/core/Action",
function(Class, Widget, Action) {
	var Menu = new Class("Menu", "Widget", {
		// start out NOT showing
		isShowing : false,

		// if true, we automatically hide the menu when a ".menuItem" child is clicked
		autoHide : true,

		// set to true to automatically bring the menu to front when shown
		bringToFront : false,

		// automatically hide when the mouse is clicked outside of us when we're shown
		hideOnOutsideClick : true,

		parts : {
			$items 				: "LIVE:## .MenuItem,button",
			$itemsAndSeparators	: "LIVE:## .MenuItem,button,separator",
			$submenuItems 		: "LIVE:## .MenuItem.hasSubmenu"
		},

		events : [
			// don't hide when mouse up in submenu items
			{ selector:"$submenuItems", event:"mouseup", handler:"onSubmenuItemUp" },

			// anywhere else they click, hide the menu on mouseup
			{ selector:"$root", event:"mouseup", handler:"onMenuBgUp" },

			// track mouseenter/mouseleave to show submenus as the mouse moves
//TODO: mouseDown to show submenus for mobile
			{ selector:"$submenuItems", event:"mouseenter", handler:"onSubmenuItemEnter" },
			{ selector:"$items", event:"mouseleave", handler:"onItemOut" },
		],

		keyMap : [
			// escape keys hides currently visible menus
			{ keys: "ESCAPE", whenFocused:true, handler:"hide" },
		],

		// Eat click events on disabled elements.
		onReady : function() {
			// Eat click events on disabled elements.
			this.$root.eatEvent("click", ".disabled");
			this.asWidget("onReady");
		},


	//
	//	showing/hiding
	//


		// Remember the current top-level menu as `Menu.activeMenu`.
		//
		// If we go to show another top-level menu (eg: one w/o a `parentMenu`)
		//	hide the current `activeMenu` first, so only one is showing.
		onShowing : function() {
			// if we're showing as a submenu, we'll never be the 'activeMenu'.
			if (this.parentMenu) return;

			// if we're not the current activeMenu, hide it
			if (Menu.activeMenu && Menu.activeMenu != this) {
				Menu.activeMenu.hide();
				delete Menu.activeMenu;
			}

			// remember us as the activeMenu
			Menu.activeMenu = this;
			this.asWidget("onShowing");
		},

		onShown : function() {
			this.asWidget("onShown");
			// When shown, bring us to the front of all other controls if desired
			if (this.bringToFront) this.$root.bringToFront();
		},

		onHiding : function() {
			// if we're a submenu, hide our parent menu when we hide
			if (this.parentMenu) {
				this.parentMenu.hide();
				delete this.parentMenu;
			}
			// otherwise stop us being the activeMenu
			else if (Menu.activeMenu === this) {
				delete Menu.activeMenu;
			}

			// when we hide, make sure our active submenu hides as well
			this.hideActiveSubmenu();
		},

		// Show "near" some thing, which can be:
		//	- an event (we'll use .pageX and .pageY)
		//	- a jQuery vector
		//	- anything else with an 'offset' method
		// `showArgs` is ARRAY of arguments to pass to the normal `show()` call.
		NEAR_DELTA : 2,
		NEAR_ANCHOR : "top left",
		showNear : function(thing, showArgs) {
			this.show.apply(this, showArgs)
				.done(function() {
				// figure out how big we are
				// NOTE: FF does weird sizing stuff if we're to the left edge of the window
				//		 so start us out at 0,0.
				this.$root.css({left:0, top:0});
				var size = this.$root.size();

				// see if we can figure out where to show
				var position;
				if (thing) {
					// jQuery vector
					if (typeof thing.offset === "function") {
						position = thing.offset();
						if (this.NEAR_ANCHOR.contains("right") || (showArgs && showArgs.location && showArgs.location.contains("E"))) {
							if (typeof thing.outerWidth === "function") position.left += thing.outerWidth();
						}
						if (this.NEAR_ANCHOR.contains("bottom") || (showArgs && showArgs.location && showArgs.location.contains("S"))) {
							if (typeof thing.outerHeight === "function") position.top += thing.outerHeight();
						}
					}
					// event
					else if (typeof thing.pageX === "number") {
						position = {left:thing.pageX, top:thing.pageY};
					}
				}
				if (!position) return;


				// offset by our NEAR_DELTA
				position.left = position.left + this.NEAR_DELTA;
				position.top  = position.top  + this.NEAR_DELTA;

				// make sure we don't go off the screen
				if (position.left < 0) {
					position.left = 0;
				} else if (position.left + size.width > window.innerWidth) {
					position.left = window.innerWidth - (size.width + this.NEAR_DELTA);
				}
				if (position.top < 0) {
					position.top = 0;
				} else if (position.top + size.height > window.innerHeight) {
					position.top = window.innerHeight - (size.height + this.NEAR_DELTA);
				}

				this.$root.css(position);
			}.bind(this));
		},


	//
	//	submenu support
	//

		// pointer to our active subMenu (there can be only one)
// TODO: will this support multiple levels of nesting?
		activeSubmenu : undefined,

		// Show this menu as a submenu of some other menu.
		// NOTE: the other menu won't be hidden!
		showAsSubmenuOf : function(otherMenu, $menuItemToShowNear) {
			if (!otherMenu) {
				console.warn(this,".showAsSubmenuOf(): otherMenu not defined!");
				return;
			}
			// if the otherMenu is defined and we can hide it
			if (otherMenu && typeof otherMenu.hide === "function") {
				// remember it as our parentMenu so we'll hide it later
				this.parentMenu = otherMenu;
				// tell it to ignore it's own "hide"
				if (otherMenu.clearSoon) otherMenu.clearSoon("hide");
			}

			this.showNear($menuItemToShowNear, {location:"E"});
		},

		SUBMENU_HOVER_TIME : 100,	// time hovering over a menuitem before submenu shows up

		// Mouse moved over a menuItem with a submenu -- show the submenu after a short delay.
		onSubmenuItemEnter : function(event, $item) {
			var submenu = UI[$item.attr("submenu")];
//			console.info("OVER: ",this+"onItemEnter(",$item,")", submenu);

			// if we're getting an itemOver for the current submenu, forget it
			if (this.activeSubmenu && this.activeSubmenu === submenu) return;

			// hide any other submenu which may be showing
			if (this.activeSubmenu && this.activeSubmenu != submenu) this.hideActiveSubmenu();

			// if a submenu was detected (and we're not disabled)
			if (submenu && !$item.hasClass("disabled")) {
				// set a timer to show the submenu after a short delay
				clearTimeout(this.submenuHoverTimeout);
				this.submenuHoverTimeout = setTimeout(function() {
					if (this.activeSubmenu && this.activeSubmenu != submenu) {
						this.hideActiveSubmenu();
					}
					submenu.showAsSubmenuOf(this, $item);
					this.activeSubmenu = submenu;
				}.bind(this), this.SUBMENU_HOVER_TIME);
			}
//			console.warn($item, $item.attr("submenu"));
		},

		// Mouse is leaving a menu item, clear activeSubmenu if we're not going into that submenu.
		onItemOut : function(event, $item) {
			// if we're still actually inside the main item, forget it
			if ($.contains($item, event.relatedTarget)) return;

//console.debug("OUT: ",this+"onItemOut(",$item,")", event.relatedTarget);
			clearTimeout(this.submenuHoverTimeout);
			delete this.submenuHoverTimeout;

			if (this.activeSubmenu) {
				var activeSubmenuContainsCursor = $.contains(this.activeSubmenu.$root[0], event.relatedTarget);
				if (!activeSubmenuContainsCursor) {
					this.hideActiveSubmenu();
				}
			}
		},

		// Clear the active submenu and reset our data structures.
		hideActiveSubmenu : function() {
			clearTimeout(this.submenuHoverTimeout);
			delete this.submenuHoverTimeout;
			if (this.activeSubmenu) {
				// make sure submenu hide doesn't hide us!
				delete this.activeSubmenu.parentMenu;
				this.activeSubmenu.hide();
				delete this.activeSubmenu;
			}
		},



	//
	//	normal event handling
	//

		// Suppress down/up/click events on disabled menu items.
		onItemDown : function(event, $item) {
			if ($item.hasClass("disabled")) event.stop();
		},

		// If mouse goes up in a submenu item, don't auto-hide the menu.
		onSubmenuItemUp : function(event) {
			event.stop();
		},

		// When mouse goes up in the menu bg, hide the menu.
		onMenuBgUp : function(event, $item) {
			// ignore right click mouseup
			if (event.button !== 0) return;
			if (this.autoHide) this.soon("hide");
		},


	//
	//	check semantics
	//

		// Check or uncheck menuItems according to some function:
		//	- if the function returns `true` or `false`, check/uncheck them item
		//	- if the function returns undefined, ignore that item
		//	You can pass a custom selector to restrict the set of items; default is our itemSelector
		checkItems : function(callback, selector) {
			if (!selector) selector = this.itemSelector;
			this.$root.find(selector).each(function(index, item) {
				var $item = $(item);
				var checkIt = callback($item);
				if (checkIt === true || checkIt === false) {
					$item.toggleClass("checked", checkIt)
						 .toggleClass("unchecked", !checkIt);
				}
			});
		}

	});	// end new Class("Menu")

//
//	`AppMenuButton` support:
//	Handlers to show top-level menus when we click on a `AppMenuButton`.
// 	NOTE: if we're currently showing a top-level menu, we'll show other top-level menus on hover.
//
	// Click on a `.AppMenuButton` element will show that menu.
	$("body").on("click", ".AppMenuButton", function(event) {
		var $target = $(event.currentTarget);
		var menu = UI[$target.attr("menu")];
		if (!menu) return console.warn("Menu.AppMenuButton on click: no menu found for ", $target[0]);
		menu.showNear($target);
	});

	// If we're showing a menu, hover over a different `AppMenuButton` will show that menu.
	$("body").on("mouseenter", ".AppMenuButton", function(event) {
		// if not already showing a menu, forget it
		if (!Menu.activeMenu) return;
		var $target = $(event.currentTarget);
		var menu = UI[$target.attr("menu")];
		if (menu && menu !== Menu.activeMenu) menu.showNear($target);
	});


	return Menu;
});	// end define("oak/lib/ui/Menu")


