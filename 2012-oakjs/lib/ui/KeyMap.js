/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	KeyMap support.
//
//  A KeyMap takes a list of Actions (or actionId strings for global Actions)
//	and fires the appropriate action.handler when the corresponding key combination is typed.
//
//	If an action's key-combo is invoked but its "visible" is currently false, pass the key event on.
//	If an action's key-combo is invoked but its "visible" is currently true, but its "enabled" is false,
//		we'll eat the key event.
//

Module.define("oak/lib/ui/KeyMap",
"oak/lib/core/Class,oak/lib/ui/UI,oak/lib/jquery/jquery.extensions,oak/lib/core/Action",
function(Class, UI, jqExtensions, Action)
{
	UI.extend({
		// Map of currently pressed keys.
		// TODOC...
		keys : {},

		// Active key maps.
		keyMaps : [],

		// Make a `keyMap` active.
		addKeyMap : function(keyMap) {
			if (!keyMap) return;
			if (!(keyMap instanceof Class.KeyMap)) throw "UI.addKeyMap(): You must pass a KeyMap instance.";
			UI.keyMaps.append(keyMap);
		},

		// De-activate a keymap.
		// NOTE: pass the same `keyMap` that you passed to `UI.addKeyMap()`!
		removeKeyMap : function(keyMap) {
			UI.keyMaps.remove(keyMap);
		},


		// Show the titles for all active keyMaps.
		showShortcuts : function() {
			if (UI.keyMaps.length === 0) return;

			Module.require("oak/lib/ui/ShortcutsOverlay", function(overlay) {
				overlay.showModal();
			});
		}

	});

	// Singleton separator item, used for adding dividers to shortcut key display.


	var KeyMap = new Class("KeyMap",
	// instance methods
	{
		// List of Actions for this KeyMap.  See `oak/lib/core/Action.js` for details.
		actions : undefined,

		// Scope to `call()` actions on.  Defaults to `UI`.
		scope : undefined,

		// initialize with a list object
		init : function(actions, scope) {
			// default scope
			if (!scope) scope = UI;
			this.scope = scope;

			// if `actions` is a function, make it a getter
			if (typeof actions === "function") {
				Object.defineProperty(this, "actions", {get:actions, enumerable:false});
			}
			// an array -- initialize items as proper Actions if necessary
			else if (Array.isArray(actions)) {
				// normalize keys to an array and set scope on each
				this.actions = [];
				actions.forEach(function(action, index) {
					if (!action) return;
					// if we got a string
					if (typeof action === "string") {
						// if it starts with a "-", it's a separator for the keyboard shortcuts
						if (action.charAt(0) === "-") {
							action = KeyMap.SEPARATOR;
						} else {
							// look up in global action registry
							action = Action.get(action);
							if (!action) return console.warn("KeyMap.init(): couldn't find global action w/id '"+actions[index]+"'");
						}
					}
					// if we've got a POJO, convert it to an Action
					if (! (action instanceof Action)) {
						// NOTE: scope must be set up in the initializer!
						action = new Action(action, this.scope);
					}

					// if we get an object, convert
					if (!(action instanceof Action)) return console.warn("KeyMap.init(): don't know what to do with ",action);
					this.actions.append(action);
				}, this);
			}
			// ???
			else {
				throw "KeyMap.init(): you must pass a list of Actions or a function when creating a keyMap!";
			}
		},

		// Return an array of actions for this KeyMap which match the given event.
		// KeyHandlers with an `enabled` which is not currently valid will be skipped.
		getMatchingActions : function(event) {
			var matches = [];
			var actions = this.actions;
			// knock out events which shouldn't fire when focused if we're focused in an input
			if (KeyMap.eventIsFocused(event)) {
				actions = actions.filter(function(action){return !!action.whenFocused});
			}
			actions.forEach(function(action) {
				if (!action.visible || !action.enabled) return;
				// does the action match the current keys?
				var keys = action.matchingKeys(UI.keys);
				if (keys) {
					// add it to the list of matches
					matches.append({keys:keys, action:action, scope:this.scope});
				}
			}, this);
			return matches;
		}
	},

	// class methods
	{
		// if true, we print lots of debugging crap
		debug : false,

		// special separator "Action"
		//	used to add separators in keymaps for ShortcutsOverlay.
		SEPARATOR : new Action({title:"SEPARATOR"}),

		// Map of keyCode -> logical key name
		// NOTE: the following have only been verified on:
		//			- firefox mac w/ extended US keyboard
		//			- safari mac w/ extended US keyboard
		//			- chrome mac w/ extended US keyboard
		//
		//	NOTE:  we also have "NUM-EQUALS" and "NUM-ENTER" which are picked up specially
		//			(see `KeyMap.keyNameForEvent()`).
		KEY_CODE_TO_NAME_MAP : {
			8	: "DELETE",
			9	: "TAB",
			12	: "NUM-CLEAR",
			13	: "RETURN",
			16 	: "SHIFT",
			17	: "CTRL",
			18	: "ALT",
			27	: "ESCAPE",
			32	: "SPACE",
			33	: "PAGE_UP",
			34	: "PAGE_DOWN",
			35	: "END",
			36	: "HOME",
			37	: "LEFT",
			38	: "UP",
			39	: "RIGHT",
			40	: "DOWN",
			46	: "FORWARD_DELETE",
			59	: "SEMI_COLON",			// firefox mac
			61	: "EQUALS",				// firefox mac
			96	: "NUM-0",
			97	: "NUM-1",
			98	: "NUM-2",
			99	: "NUM-3",
			100	: "NUM-4",
			101	: "NUM-5",
			102	: "NUM-6",
			103	: "NUM-7",
			104	: "NUM-8",
			105	: "NUM-9",
			106	: "NUM-MULTIPLY",
			107	: "NUM-ADD",
			108	: "NUM-ENTER",
			109	: "NUM-SUBTRACT",
			110	: "NUM-PERIOD",
			111	: "NUM-DIVIDE",
			124	: "F13",
			125	: "F14",
			126	: "F15",
			127	: "F16",
			128	: "F17",
			129	: "F18",
			130	: "F19",
			173	: "DASH",				// firefox mac
			186	: "SEMI_COLON",			// chrome, safari mac
			187	: "EQUALS",				// chrome, safari mac
			188	: "COMMA",
			189	: "DASH",				// safari mac
			190	: "PERIOD",
			191	: "SLASH",
			192	: "BACKQUOTE",
			219	: "LEFT_BRACKET",
			220	: "BACKSLASH",
			221	: "RIGHT_BRACKET",
			222	: "QUOTE",
			224	: "META"
		},

		KEY_NAME_TO_TITLE_MAP : {
			"ALT"				: "⎇",
			"BACKQUOTE"			: "`",
			"BACKSLASH"			: "\\",
			"COMMA"				: ",",
			"CTRL"				: "^",
			"DASH"				: "-",
			"DELETE"			: "⌫",
			"DOWN"				: "↓",
			"END"				: "end",
			"EQUALS"			: "=",
			"ESCAPE"			: "esc",
			"F13"				: "F13",
			"F14"				: "F14",
			"F15"				: "F15",
			"F16"				: "F16",
			"F17"				: "F17",
			"F18"				: "F18",
			"F19"				: "F19",
			"FORWARD_DELETE"	: "⌦",
			"HOME"				: "home",
			"LEFT_BRACKET"		: "]",
			"LEFT"				: "←",
			"META"				: "⌘",
			"NUM-0"				: "NUM0",
			"NUM-1"				: "NUM1",
			"NUM-2"				: "NUM2",
			"NUM-3"				: "NUM3",
			"NUM-4"				: "NUM4",
			"NUM-5"				: "NUM5",
			"NUM-6"				: "NUM6",
			"NUM-7"				: "NUM7",
			"NUM-8"				: "NUM8",
			"NUM-9"				: "NUM9",
			"NUM-ADD"			: "NUM+",
			"NUM-CLEAR"			: "clear",
			"NUM-PERIOD"		: "NUM.",
			"NUM-DIVIDE"		: "NUM\\",
			"NUM-ENTER"			: "NUM↵",
			"NUM-MULTIPLY"		: "NUM*",
			"NUM-SUBTRACT"		: "NUM",
			"PAGE_DOWN"			: "pgDn",
			"PAGE_UP"			: "pgUp",
			"PERIOD"			: ".",
			"QUOTE"				: "'",
			"RETURN"			: "↵",
			"RIGHT_BRACKET"		: "[",
			"RIGHT"				: "→",
			"SEMI_COLON"		: ";",
			"SHIFT"				: "⇧",
			"SLASH"				: "/",
			"SPACE"				: "space",
			"TAB"				: "tab",
			"UP"				: "↑",
		},

		keyNameToTitle : function(keyName) {
			return KeyMap.KEY_NAME_TO_TITLE_MAP[keyName] || keyName;
		},

		// logical names of modifier key names
		MODIFIER_KEY_NAMES : {
			"CTRL"	: 1,
			"SHIFT"	: 1,
			"ALT"	: 1,
			"META"	: 1
		},

		// Initialize global keyboard events.  Called at the end of this file.
		init : function() {
			var $doc = $(document);
			$doc.captureEvent("keydown", KeyMap.onKeyDown.bind(KeyMap));
			$doc.captureEvent("keyup", KeyMap.onKeyUp.bind(KeyMap));
		},

		// Check all keyMaps and fire appropriate events.
		// NOTE that this is called with a normal event, not a jQuery specified event.
		checkAllMaps : function(event) {
			// find any matching key events
			var matches = [];
			UI.keyMaps.forEach(function(keyMap) {
				matches = matches.concat(keyMap.getMatchingActions(event));
			});
			if (matches.length === 0) return;

			event.stop = function() {
				event.preventDefault();
				event.stopPropagation();
				event.stopped = true;
			}

			// call `fireBestMatch()` to fire the matching key command with the most specificity.
			// If that action specifically says NOT to stop, we'll then fire the next most specific.
			// NOTE: we'll generally only fire one, setting `action.stop` to false is rare.
			while (matches.length) {
				var match = this.fireBestMatch(matches, event);
				if (match.stop !== false) {
					event.stop();
				}
				if (event.stopped) return;
			}
		},

		// Given a list of matching {action:, scope:} objects, fire the "best" one.
		// This is the first one in the list with the highest number of modifier keys.
		// Returns the item fired.
		// NOTE: removes the fired item from the list of mathes, so you can call this recursively to call the next one.
		fireBestMatch : function(matches, event) {
			// Find the LAST item in the list of matches with the MOST modifier keys.
			// This is what we'll fire.
			var level = 0, bestMatch;
			matches.forEach(function(match) {
				if (match.action.keys.length >= level) {
					level = match.action.keys.length;
					bestMatch = match;
				}
			});
			// remove the match from the list of matches, so we can be called recursively to get the next one
			matches.remove(bestMatch);
			var action = bestMatch.action;
			var scope  = bestMatch.scope;

			// de-normalize the action
			if (KeyMap.debug) console.debug("keymap firing for keys ", action._keyList,"  action:", action, "  scope:", scope);

			// attempt to execute the handler
			try {
				// remember event on KeyMap so the action can access it if necessary.
				KeyMap._firingKeyHandler = action;		// debug, leave for testing
				action.fire(scope, [event]);
			} catch (e) {
				console.group("Error calling key handler for: ",action);
				console.error(e);
				console.groupEnd();
			}
			delete KeyMap.event;
			delete KeyMap._firingKeyHandler;				// debug, leave for testing

			return bestMatch;
		},

		// Update  `UI.keys` to reflect the current keyboard state.
		//
		// This also sets classes on the HTML element to correspond to keys being down
		// this lets you write CSS rules to reflect the current state, eg:
		//
		//		html.shiftDown .someWidget	{ background:red;	}
		//
		updateKeyState : function(event) {
			if (!event) throw "updateKeyState() wants an EVENT!";

			KeyMap._setOrClearModifier(event.altKey,   "ALT",   "altKeyDown");
			KeyMap._setOrClearModifier(event.metaKey,  "META",  "metaKeyDown");
			KeyMap._setOrClearModifier(event.ctrlKey,  "CTRL",  "ctrlKeyDown");
			KeyMap._setOrClearModifier(event.shiftKey, "SHIFT", "shiftKeyDown");

			var key = KeyMap.keyNameForEvent(event);
			if (event.type === "keydown") {
				UI.keys[key] = true;
			}
			else if (event.type === "keyup") {
//console.debug("keyup: ",key,":",event.keyCode);
				delete UI.keys[key];
			}

			this.debugKeyEvent(event);

			return key;
		},

		// Set or clear `UI.keys` value for a modifier key according to the state of the event value.
		// Also sets or clears `className` on our <html> element.
		_setOrClearModifier : function(eventValue, keyName, className) {
			eventValue = !!eventValue;
			var keyValue = !!UI.keys[keyName];
			if (eventValue === keyValue) return;
			if (eventValue)	UI.keys[keyName] = true;
			else			delete UI.keys[keyName];
			UI.toggleClass(className, eventValue);
		},

		// Return the logical key name which corresponds to a keyboard event.
		keyNameForEvent : function(event) {
			var key = KeyMap.KEY_CODE_TO_NAME_MAP[event.keyCode];
			if (key) {
				// Chrome + FF (on Mac at least) will set `event.location === 3` if a numpad key was pressed.
				// Safari will use `event.keyLocation === 3` for the same thing.
				//	Special case to catch numpad "EQUALS" and "RETURN" keys, since no (mac) browser seems to get them right.
				if (event.location === 3 || event.keyLocation === 3) {
					if 		(key === "EQUALS") 	key = "NUM-EQUALS";
					else if (key === "RETURN") 	key = "NUM-ENTER";
				}
				return key;
			}
			return String.fromCharCode(event.keyCode).toUpperCase();
		},

		// Update the 'UI.keys' state and fire any registered actions on key down.
		// NOTE:  Modern browsers will repeatedly fire "keydown" events if a key is held down.
		//		  This lets us deal with this event rather than `keypress`,
		//		   which has considerably different semantics.
		onKeyDown : function(event) {
			// update `UI.keys` state
			var key = KeyMap.updateKeyState(event);
			// fire any actions which match the current state
			KeyMap.checkAllMaps(event);
			// if command key is down and we're not a modifier key, remove the key from `UI.keys`
			if (UI.keys.META && !KeyMap.MODIFIER_KEY_NAMES[key]) delete UI.keys[key];
		},

		// Update the 'UI.keys' state when a key goes up.
		onKeyUp : function(event) {
			setTimeout(function() {
				KeyMap.updateKeyState(event);
			}, 0);
		},


		// Return true if the keyboard event is:
		//	- focused in a <input>, <textarea> or <select>
		//	- inside an HTML editing context (attr "contenteditable")
		eventIsFocused : function(event) {
			if (!event || !event.target) return false;
			var $target = $(event.target);
			return ($target.isAFormField() || $target.attr("contenteditable"));
		},

		// Print a message about the keyboard event
		debugKeyEvent : function(event) {
			if (!KeyMap.debug) return;
			console.debug("UI.keys on: ",event.type, "  keys:  ", Object.keys(UI.keys));
		}

	});	// end new Class("KeyMap")

	// initialize key event capture
	KeyMap.init();

	return KeyMap;

});	// end define("oak/lib/ui/KeyMap")
