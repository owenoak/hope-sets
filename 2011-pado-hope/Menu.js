/* Menus, eg: context menus 

	Note: When this is initialized, we add a global "contextmenu" handler to the body
			which displays a context menu for any element which has a "menu" attribute (property?).
*/

//TODO: doesn't handle nested menus
//TODO: showing menu 2 should hide menu 1
//TODO: leave body.autoHide handler on all the time and key off menu being set?
//TODO: when menu showing, use keys:
//			- arrows to go up/down menu
//			- return to select
//			- escape to clear menu

Script.require("{{hope}}Element-attach.js", function(){


function _hasContextMenu() {
	return (this.menu != null);
}

// Watch for the "contextmenu" event on the body, and show the contextmenu for the first
//	element UP from the target which has a "menu" attribute or a 'menu property' defined.
//
// NOTE: if the meta (command) key is down, we show the normal browser menu instead.  Useful.
hope.onReady("document", function() {
	document.body.on(
		"contextmenu", 
		function(event) {
			// figure out who has a context menu
			var target = event.target.selectUp(_hasContextMenu, true);
			if (!target) return;
			//console.warn("sending contextmenu to ",target);			
			// DEBUG: QUESTIONABLE
			//	if meta key is down, show the standard menu instead of the custom menu
			if (event.metaKey) return;
			if (hope.Menu.showMenuFor(target) !== CONTINUE) event.stop();
	});
});



new Element.Subclass("hope.Menu", {
	tag : "hope-menu",
	properties : {
		template : "<hope-container/>",

		visible : false,
		autoHide : new Attribute({name:"autoHide", type:"flag", falseIf:[false,"false","no"]}),
		
		// attach this menu to some element
		showForElement : function(element, event) {
			// set the "context" property of me (and all my children) to the element
			//	to make it easy to reference the menu
			var menu = this;
			this.recurse(function() { this.menu = menu; this.context = element; });
			// show the menu immediately (may do an animation)
			this.visible = true;

			// hide the menu on click if autoHide is true
			// NOTE: this breaks submenus!
			if (this.autoHide) {
				document.body.observe({	eventType:"click", once:true, capture:true, scope:this,
										handler:function() {
											this.visible = false
										}
									});
			}
			
			// if we have a browser event, move to be under the mouse
			this.moveToEvent(event);
			
			// tell the element that we're about to show!
			element.fire("showingContextMenu");
		},
		
		clearMenuItems : function() {
			this.$container.html = "";
		},
		
		addMenuItem : function(value, title) {
			if (title == null) title = value;
			this.$container.append("<row value='"+value+"'><label>"+title+"</label></row>");
		}
	},
	
	"static" : {
		debug : hope.debug("Menu"),
		
		showMenuFor : function(element, menuSelector) {
			if (menuSelector == null) menuSelector = element.menu;
			var menu = select(menuSelector);
			if (!menu) return CONTINUE;
			menu.showForElement(element);
			return STOP;
		}
	}
});


new hope.Action.Subclass("hope.MenuAction", {
	tag : "hope-action",
	selector : "hope-action[type=menu]",
	properties : {
		menu : Attribute({name:"menu",update:true}),
		$menu : Property({
			get : function() {
				return select(this.menu);
			},
			set : function(menu) {
				if (!menu.id) throw "Must specify an id when setting MenuAction.$menu";
				this.menu = menu.id;
			}
		}),
		
		onActivate : function() {
			var $menu = this.$menu;
			if ($menu) $menu.showForElement(this);
		}
	
	}
});



Script.loaded("{{hope}}Menu.js");
});
