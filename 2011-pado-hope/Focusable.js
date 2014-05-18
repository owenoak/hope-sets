/* Shortcut key handling.
	- ANY element can have a shortcut key combo
	- invoking the shortcut calls `element.fire("activate")`
	- if the element is disabled, the shortcut is ignored


	TODO:
		- when reparenting objects, need to change their shortcut parents... :-(
		- more than one shortcut for an item? necessary?
*/

Script.require("{{hope}}Event-keys.js", function(){


// you can give ANYTHING a shortcut
Element.prototype.extend({
	shortcut : Attribute({name:"shortcut",
					onChange : function(shortcut, oldShortcut) {
						if (shortcut) {
							var focusParent = this.focusParent;
							if (focusParent && focusParent.addShortcut) {
								focusParent.addShortcut(this);
							}
						}
					}
				}),
				
	// Find the first item above element (including element) which is focusable.
	focusParent : Getter(function() {
		var it = this;
		while (it) {
			if (it.focusable) return it;
			it = it.parentNode;
		}
	})
});


// Mix "Focusable" into a class to make it respond to key events from it or its children.
new Mixin("Focusable", {
	properties : {

		// flag that we're focusable
		focusable : true,
		
		addShortcut : function(element) {
			var keyMap = (this.keyMap || (this.keyMap = new hope.KeyMap()));
			keyMap.addShortcut(element);
		},
		
		removeShortcut : function(element) {
			if (this.keyMap) this.keyMap.removeShortcut(element);
		},
	
		handleKeyPress : function(event) {
			if (this.keyMap) return this.keyMap.handleKeyPress(event);
		}
	}
});


// create a global keymap by making the global key listener object Focusable
var globalListener = Element.create(Browser.EVENT.globalKeyListenerTagName);
Focusable.mixinTo(globalListener.constructor.prototype);


//
// KeyMap class
//
new hope.Element.Subclass("hope.KeyMap", {
	tag : "hope-keymap",
	properties : {
		onReady : function() {
			this.map = {};
		},
		
		visible : false,
		template : "<hope-closer/><hope-container></hope-container>",
		listeners : "mousedown:onMouseDown",
		
		addShortcut : function(element) {
			var shortcut = Shortcut.normalize(element);
			if (this.map[shortcut] == null) this.map[shortcut] = [];
			this.map[shortcut].push(element);
		},
		
		removeShortcut : function(element) {
			var shortcut = Event.normalizeShortcut(element);
			if (this.map[shortcut] == null) return;
			this.map[shortcut].remove(element);
			if (this.map[shortcut].length == 0) delete this.map[shortcut];
		},

		handleKeyPress : function(event) {
			if (!this.enabled || !this.map) return CONTINUE;
			// NOTE: we use Event.shortcut for the lookup,
			//		 because figuring the shortcut in keypress is not reliable
			var list = this.map[Event.shortcut];
			if (!list) return CONTINUE;
			var element, i = -1;
			while (element = list[++i]) {
				if (!element.enabled) continue;
				if (element.showActive) {
					element.showActive(true);
					setTimeout(function(){
						element.showActive(false);
					}, 500);
				}
//console.warn(Event.shortcut, element);
				if (element.fire("activate") !== CONTINUE) {
					if (event) event.stop();
					return STOP;
				}
			}
			return CONTINUE;
		},
		
		onMouseDown : function() {
			this.visible = false;
			return false;
		}
	}
});


//
//	Stick a <keymap> under any element to make it focusable.
//
Element.prototype.extend({
	childProcessors : "hope-keymap:initKeyMap",
	initKeyMap : function() {
		if (!this.focusable) Focusable.mixinTo(this);
	}
});



// have a general keypress handler which calls focusables to see if they want the keypress
window.on(Browser.EVENT.keypress, function(event) {
	// TODO: this should take our focus concept into account...
	var focusParent = event.target.focusParent;
	if (!focusParent) return;

	var shortcut = Shortcut.normalize(event);
	while (focusParent) {
		if (focusParent.handleKeyPress(event, shortcut) === STOP) return;
		focusParent = focusParent.parentNode ? focusParent.parentNode.focusParent : null;
	}
});




Script.loaded("{{hope}}Shortcuts.js");
});
