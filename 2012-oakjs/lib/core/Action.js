/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

// # Class `Action`
//  Actions which can be performed from a menu, command key, right-click menu, etc.
//
// * Each action has an id.
// * You can add actions to menus by id.
// * You can add actions to keymaps by id.
// * Actions can "visible" and "enabled" and getTitle()
// *	*NOTE: implicit dependence on oak/lib/ui/KeyMap, oak/lib/ui/UI*.
//
Module.define("oak/lib/core/Action",
"oak/lib/core/Class,oak/lib/core/Property-Exotic",
function(Class, Property) {

	var Action = new Class("Action", {

	//
	// ## Instance properties
	//

		// ######  `action.id` (string)
		// > Global id of this action.
		// > If you provide one, it MUST be unique within this entire app.
		// > If you provide one, we'll register this action so you can call
		// >	`Action.fire("MyActionId")`
		id : undefined,

		// ###### `action.title` (string or function)
		// > Title of the action.
		// > 	- Set to a string for a static value.
		// > 	- Set to a function to have a dynamic value (which will be applied to `action.scope`).
		// >	- If not set, we'll default to the
		title : Property({
			get : function() {
				var title = this._private.title;
				if (!title) return Messages.get("actions."+this.id, this.scope);
				if (typeof title === "function") return title.apply(this.scope);
				return title;
			},
			set : function(method) {
				this._private.title = method;
			}
		}),

		// ###### `action.hint` (string)
		// > Special "hint" for this action in the ShortcutOverlay.
		// > If you don't provide one, we'll use `action.title`.
		hint : Property({
			get : function() {	return this._private.hint || this.title;	},
			set : function(hint) {	this._private.hint = hint;	}
		}),

		// ###### `action.handler` (string or function)
		// > Handler function when this action is invoked.
		// > Ignored if submenu is defined.
		// > If you pass a string, we'll assume it's a named method on `action.scope`
		// > (or `KeyMap.scope` if called in the context of a keymap and no `action.scope` defined).
		handler : undefined,

		// ###### `action.scope` (object)
		// > Scope for the handler.  Defaults to `UI`.
		// > If you call `action.fire()`, you can pass in another scope (eg: for keymaps).
		// > *note:* if you're defining visible, enabled or checked properties as STRINGS,
		// > 		 you MUST pass scope to `init()`!
		scope : undefined,

		// ###### `action.submenu` (string)
		// > Global `id` of a submenu that should be shown when this action is invoked.
		// > Generally used in menus or context menus.
		// > If you have `submenu` defined, the `handler` is ignored.
		submenu : undefined,

		// ###### `action.visible` (boolean or boolean expression or function)
		// > Should this action be shown?  (Default is yes).
		// > Initialize with a function or a script fragment for a dynamic check (which we'll turn into a Getter).
		// > Note that the check is called in the context of `action.scope` which must be defined in `init()`.
		visible : Property.BooleanExpression({value:true, enumerable:false, callOnScope:true}),

		// ###### `action.enabled` (boolean or boolean expression or function)
		// > Should this action be enabled?  (Default is yes).
		// > Initialize with a function or a script fragment for a dynamic check (which we'll turn into a Getter).
		// > Note that the check is called in the context of `action.scope` which must be defined in `init()`.
		enabled : Property.BooleanExpression({value:true, enumerable:false, callOnScope:true}),

		// ###### `action.checkable` (boolean)
		// > Can we show a checkmark next to this item? (Default is no).
		checkable : false,

		// ###### `action.checked`  (boolean or boolean expression or function)
		// > Is this item currently "checked"?  (Default is no).
		// > Only used if `checkable` is true.
		// > Initialize with a function or a script fragment for a dynamic check (which we'll turn into a Getter).
		// > Note that the check is called in the context of `action.scope` which must be defined in `init()`.
		checked : Property.BooleanExpression({value:false, enumerable:false, callOnScope:true}),

		// ###### `action.whenFocused` (boolean)
		// > Should the key command for this item be enabled
		// > when the user is typing in an &lt;input> ?  (Default is no)
		whenFocused : false,

		// ###### `action.keys` (string)
		// > Generic shortcut-key(s) for this action (assumes we're on a mac).
		// > Set to a single space-separated string.
		// > You can define multiple keys for the same action with a comma, eg: `"META PERIOD,NUM-SUBTRACT"`
		keys : undefined,

		// ###### `action.mac` (string)
		// > Mac-desktop-app specific shortcut-key(s) for this action.
		// > Will override `action.keys` if we're in the Mac native app.
		mac : undefined,

		// ###### `action.pc` (string)
		// > Windows-desktop-app specific shortcut-key(s) for this action.
		// > Will override `action.keys` if we're in the PC native app.
		pc : undefined,

		// ###### `action.shortcuts` (string)
		// > Shortcut key(s) for this action, according to our current platform.
		shortcuts : Property.Getter(function() {
			var shortcuts = this._private.shortcuts;
			if (shortcuts === undefined) {
				// generic keys for all platforms
				var keys = this.keys, shortcuts;
				// specific keys for native app
				if (Browser.is.nativeapp) {
					if (Browser.is.macos   && this.mac) keys = this.mac;
					if (Browser.is.windows && this.pc)  keys = this.pc;
				}
				if (keys) {
					shortcuts = keys.splitByCommas().map(function(shortcut){return shortcut.splitBySpaces()});
				}
				this._private.shortcuts= shortcuts;
			}
			return this._private.shortcuts;
		}),



	//
	// ###	Initialization
	//

		// ###### `new Action(properties, scope)`
		// > Initialize this object, called automatically when action is created.
		// > You *must* provide a `properties` object, which can have any of the properties above
		// > 	or method overrides.
		// > You can pass a separate `scope` object which will be used for all dynamic
		// > `title`, `visible`, `enabled`, `checked` properties.
		init : function(properties, scope) {
			if (!properties) 					throw "You must specify properties when creating an action!";

			// Register the action globally if they specified an id.
			var id = properties.id;
			if (id) {
				this.id = id;		// set id first, for debugging

				// Warn if there's already an action with that id...
				if (Action.REGISTRY[id]) {
					console.warn(this,".init(): Duplication action id "+id+" specified");
				// ...or register the action if not.
				} else {
					Action.REGISTRY[id] = this;
				}
			}

			// Set scope first if defined, so it's set up for getter initialization below.
			var scope = scope || properties.scope;
			if (scope) this.scope = scope;

			Property.extend(this, properties);
		},


		// ######  (private) `action._initFunction(method, type)` => function
		// > Given a `method` which may be a function or a script fragment,
		// > turn it into a function.
		// > If your script fragment is a boolean expression, pass `type === "BOOLEAN"`.
		// > If your script fragment is a string expression, pass `type === "STRING"`.
		// > Throws an exception if parsing a script expression causes an error.
		_initFunction : function(method, type) {
			if (typeof method === "function") return method;
			try {
				// handle boolean expressions
				if (type === "BOOLEAN") 		return new Function("return !!("+method+")");
				// handle string expressions
				else if (type === "STRING") 	return new Function("return (\""+method+"\")");
				// handle normal script fragments
				else 							return new Function(method);
			} catch (e) {
				console.warn("action._initFunction(): error creating function "+method);
				throw e;
			}
		},



	//
	//	### Action invocation
	//

		// ###### `action.fire(scope, args)`
		// > Perform this action if we are enabled.
		// > If you pass in a `scope` object, we'll use that ONLY if the action doesn't define its own scope.
		// > If you pass in `args` array, we'll send those in to the handler.
		// > **TODO: submenu?**
		fire : function(scope, args) {
			// Abort if we're not currently enabled.
			if (!this.visible || !this.enabled) {
				if (Action.debug) console.warn(this+" cancelled because it's not currently enabled");
				return;
			}

			// if scope isn't specified, use this.scope or main UI singleton.
			if (!scope) scope = this.scope || UI;

			// if handler is a string, assume it's a method on the scope
			var handler = this.handler;
			if (typeof handler === "string") {
				handler = scope[handler];
				if (!handler) {
					console.warn(this+".fire(): couldn't find handler '"+this.handler+"' on scope ",scope);
					return;
				}
			}

			// call the handler in the context of `scope`, passing in any `args`.
			try {
				return handler.apply(scope, args||[]);
			} catch (e) {
				console.error("Exception performing action "+this.id, e);
				console.trace();
			}
		},


	//
	//	### Use of Actions in menus
	//

		// ###### `action.matchingKeys(keyMap)` => string
		// Return the matching keySet if ALL of its keys are in the specified key map for ANY of our shortcuts.
		// Returns `false` if no match found.
		matchingKeys : function(keyMap) {
			if (!this.shortcuts) return false;
			var s = -1, shortcut;
			while ((shortcut = this.shortcuts[++s])) {
				var k = -1, key, allAreSet = true;
				while ((key = shortcut[++k])) {
					allAreSet = allAreSet && keyMap[key];	// keyMap[key] will be true if the key is on
				}
				if (allAreSet) return shortcut;
			}
			return false;
		},


		// ###### `action.menuItemHTML()` => string
		// > Return the HTML needed to instantiate this action as a menu item.
		// > Called automatically in `ContextMenu`s if an action is specified.
		// > Note that titles are *always* set dynamically when the menu is shown.
		menuItemHTML : function() {
			if (!this.id) throw this+".menuItemHTML(): can only call on actions with an id!";

			var classNames = ["MenuItem"];
			var attributes = ['actionid="'+this.id+'"'];

			if (this.checkable) 				classNames.append("checkbox");
			if (!this.visible || !this.enabled) classNames.append("disabled");

			if (this.submenu) {
				classNames.append("hasSubmenu");
				attributes.append("submenu='"+this.submenu+"'");
			} else {
				attributes.add("onclick='Action.fire(\""+this.id+"\")'");
			}

			var shortcuts = this.shortcutTitles;
			if (shortcuts) attributes.append('shortcut="'+shortcuts[0]+'"');

			attributes.add("class='"+classNames.join(" ")+"'");
			return "<button "+ attributes.join(" ") + "></button>";
		},

		// ###### `action.shortcutTitles`
		// >  Returns an array of all shortcut titles for this action.
		shortcutTitles : Property.Getter(function() {
			if (!this.shortcuts) return [""];
			return this.shortcuts.map(function(shortcut) {
				return shortcut.map(function(key) {
							return Class.KeyMap.keyNameToTitle(key);
						}).join("");
			});
		}),

		// ###### `action.shortcutTitleString` (string)
		// > Return an `" or "` separated string of all shortcut titles,
		// > used by `ShortcutsOverlay`.
		shortcutTitleString : Property.Getter(function() {
			return this.shortcutTitles.join(" or ");
		})

	}, // end instance properties

	//
	// ## Class properties
	//
	{
		// ###### `Action.debug`  (boolean)
		// > Set `Action.debug` to `true` to help debug action invocation.
		debug : true,

		// ###### (private) `Action.REGISTRY`  (object)
		// > Registry of named Actions.  Actions with `id`s are automatically added on `action.init()`.
		REGISTRY : {},

	//
	// ## Class methods
	//

		// ###### `Action.get(id)` => Action
		// > Given an `id`, return the registered action.
		// > Returns `undefined` if no such action registered.
		get : function(id) {
			return Action.REGISTRY[id];
		},

		// ###### `Action.fire(id, scope, args)`
		// > Perform the action specified by the given id.
		// > If the item isn't enabled or shown, this is a no-op.
		// > `scope` is scope to `apply()` to handler (will defer to specific scope set on action during `init()`.
		// > `args` are arguments to pass to handler.
		fire : function(id, scope, args) {
			var action = Action.get(id);
			// skip if no action found
			if (!action) {
				if (Action.debug) console.warn("Action.perform("+id+"): action not found");
				return;
			}
			return action.fire(scope, args);
		},

	});	// end new Class("Action");

	window.Action = Action;	// debug

	return Action;
});	// end define("oak/lib/core/Action")
