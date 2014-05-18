/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


/* Widgets are loadable content regions on the page.

	MANDATORY:
		- your widget MUST have an id
		- there must be exactly one element on the page with that id

	PATTERNS: 	you might want to use:
		- use widget.events to create a map of events which will automatically be
			hooked up when the widget is shown and unhooked when widget is hidden
		- use widget.parts to get pointers to sub-parts of your widget
			that your interact with in JS


TODO:	- auto-generate an id?  based on parent's ID?
		- default parts to $body == $root, $message == $root, $childContainer == $body
		- isShowing to show/hide automatically ?
		- message semantics: (notice?)
			- showMessage():  insert only one message at a time into $message (NOT insert)
			- clearMessage(): automatically when?
			- message dictionary as "dotted.label" protomap
		- `children` - sub-widgets that we manage
			- automatically add to our $childContainer
			- redraw them when we redraw
			- add to Panel?
		- SectionPanel ?
			- like TabPanel or Stack
			- can show one at a time or more than one
		- convert all `getHTML()` routines to `getElements()` and allow for re-use

*/

Module.define("oak/lib/ui/Widget",
"oak/lib/core/Class,oak/lib/core/Loadable,oak/lib/core/Bindable,oak/lib/api/API",
function(Class, Loadable, Bindable, API) {

	var Widget = new Class("Widget", {
		mixins : "Loadable,Bindable",

		// the id of this widget.  Must be unique in the page if specified.
		id : undefined,

		// true if we are be visible on the screen (only valid after this.initialize())
		//	Set to false initially (BEFORE initialize) to auto-hide.
		//	Note: some widgets set this false in the widget prototype, to auto-hide by default.
// TODO: dynamic
		isShowing : true,

	//
	//	initializers/loading/meta-stuff
	//

		// Draw us immediately.
		draw : function() {
			this.initialize();
			this.show();
			return this;
		},

		// Startup code, generally called right after this widget has been loaded or
		//	right before it's being shown.
		//
		// You generally shouldn't override this unless you're creating a subclass,
		//	if you want to do something after the widget is set up, implement
		//		yourWidget.onReady()
		//	instead.
		//
		//	Note: it's likely this may be called more than once, so if you want to override do
		//		if (this.asWidget("initialize")) {  ... your code here ... }
		initialize : function() {
			if (this.initialized) return this;
			// mark as loaded (NOTE: this could be a problem)
			this.isLoaded = true;

// TODO: this is not general enough -- nested widgets may not want to be top-level
			if (this.id && !UI[this.id]) UI[this.id] = this;

			// set up the pointer to our main element if not done in initIncludes
			//	OR IF PRE-EXISTING ROOT ELEMENT HAS A "replace='true'" attribute.
// TODO: just checking for id is not general enough
// TODO: auto-generate id?
			if (this.id) {
				if (!this.$root) this.$root = $("#"+this.id);
				if (this.$root.length == 0 || this.$root.attr("replace") == "true") {
					if (this.$root.attr("replace") == "true") this.$root.remove();
// TODO: this is random, we only expand the widget template if the id can't be found...
					this.$root = $(this.widgetTemplate.expand(this));
					var $parent = this.$parent || $("body");
// TODO: what if we don't want to insert into our parent?
					$parent.append(this.$root);
				}
			}
			// if we're supposed to be hidden initially, hide our root now
			if (this.$root && !this.isShowing && this.$root.isDisplayed()) {
				this.$root.hide();
			}

			// initialize our decorators
			this.initDecorators();

			// initialize our children's bits
			this.initTemplates();
			this.initParts();

			// initialize our children
			this.initChildren();

			this.initialized = true;

			// call our onReady handler, which gives you a chance to do sub-class specific
			//	setup after things (including children) have been set up
			this.onReady();

			// call any plugins defined to fire after our onReady call
			// (eg: mixins or decorators).
			this._callPlugins("onReadyPlugins");

			return this;
		},

		// template to use as HTML for the widget if it is created in widget.initialize()
		widgetTemplate : "<div id='{{id}}' class='{{constructor.id}} {{className}}'></div>",

		// class name to add to the widget if it is created in widget.initialize()
		className : "",


		// Permanently destroy this widget and all it's associated data.
		// NOTE: can't do anything about things that are pointing to us.  :-(
		destroy : function() {
			// remove any pointers to dom elements stored in our $properties
			for (var key in this) {
				if (key.charAt(0) === "$") {
					// NOTE: ignore live selectors, which will not be jQuery vectors
					if (this[key].jquery) {
						this[key].remove();
						delete this[key];
					}
				}
			}
			// remove the global pointer to me in UI
			if (UI[this.id] === this) delete UI[this.id];
		},


	//
	//	manage children
	//

		// Array of child Widgets we'll manage.
		// Currently only settable at init time.
// TODO: make this dynamic!  addChild(), removeChild()
		children : undefined,
		initChildren : function() {},

	//
	//	loading -- look in Loadable for much more!
	//

		// The invariant is that widgets can be loaded dynamically.
		//
		// Your general pattern here is to use:
		//	yourWidget.load().done( function() { your callback here } )
		//

		getLoader : function() {
// TODO: Module.appBaseUrl ???
			var url = this.src || (UI.appDir + this.id);
// TODO: what if url is a full URL?
			return Module.require(url);
		},

		// Return the widget as the result of its load.
		parseLoadedResults : function() {
			return [this];
		},

		// onLoaded is not generally used by widgets,
		//	use widget.finishedLoading() instead
		onLoaded : function(value) {},

		// Called by an asynchronous widget loader, eg:
		//		UI.SOMEWIDGET("<some html>", {properties})
		//
		// Add properties to the specified widget which has been dynamically loaded.
		//	Returns the widget.
		//
		finishedLoading : function(html, properties) {
//console.debug(this,"finishedLoading(",arguments,")");
			// html argument is optional
			if (html && (typeof html !== "string") && !properties) {
				properties = html;
				html = null;
			}
			if (properties) Property.extend(this, properties);

			if (html) {
				var $html;
				if (typeof html === "string") 	$html = API.parseOHTML(html);
				else 							$html = html;

				// inset EITHER over our old $root element...
				if (this.$root) {
					this.$root.replaceWith($html);
				}
				//  or as a child of our $parent  (defaulting to the body element if no $parent defined)
				else {
					if (!this.$parent) this.$parent = $("body");
					this.$parent.append($html);
				}

				// get our new root element
				this.$root = $("#"+this.id);

				// initialize any nested includes AFTER inserting into the document
				Widget.initIncludes($html);
			}


	// TODO... it could be problematic doing this here... ???
			this.initialize();
			this.isLoaded = true;
			return this;
		},

	//
	//	parts -- sub-html-elements to hook up automatically
	//

		// {partName => selector} map for sub-elements that you want to address conveniently.
		//	use "LIVE:..." to make a live map, otherwise we'll just assign parts statically (which is more efficient)
		//	use "## ..." to make the part relative to the $root element
		//	use "##..." to substitute the "#<id>" of the widget
		//
		// NOTE: You'll automatically pick up all `parts` from your superclasses and mixins as well.
		//		 You can override in your instance by just using a part of the same name.
		parts : Property.ProtoMap("parts"),

		// TODO: instance properties should override prototype properties!
		initParts : function() {
			var parts = this.parts;
			for (var partName in parts) {
				var selector = parts[partName];
				this._initPart(partName, selector);
			}
		},

		// Given a "partSelector", return a jQuery vector of the associated part.
		//	use "## ..." to make the part relative to the $root element
		//	use "##..." to substitute the "#<id>" of the widget
		//	otherwise it'll be a global selector
		_normalizePartSelector : function(partSelector) {
			// ...however, if selector starts with "## ",
			//	  that means it's relative to our root element
			if (partSelector.startsWith("## ")) {
				partSelector = partSelector.replace(/^## /, "");
			}
			// otherwise if "##foo" is in the selector, replace it with our id (eg:  "##foo" => "#myIdfoo")
			if (partSelector.contains("##")) {
				partSelector = partSelector.replace(/##/g, "#"+this.id);
			}
			return partSelector;
		},

		// Return true if the partSelector passed in should be local to our root element
		_isRootSelector : function(partSelector) {
			return (partSelector.startsWith("## "));
		},

		// Given a part selector, return the object it corresponds to.
		_findPart : function(partSelector) {
			var isRootSelector = this._isRootSelector(partSelector);
			var selector = this._normalizePartSelector(partSelector);
			if (isRootSelector) {
				if (!this.$root) {
					console.warn(this,"._initPart(",partName,",",selector,"): this.$root is not defined!");
					return $();
				}
				return this.$root.find(selector);
			} else {
				return $(selector);
			}
		},

		_initPart : function(partName, selector) {
			// selectors are 'live' if they start with the string 'LIVE:'
			if (selector.startsWith("LIVE:")) {
				this._initLivePart(partName, selector);
			} else {
				this[partName] = this._findPart(selector);
			}
		},

		_initLivePart : function(partName, selector) {
			// eat a "LIVE:" prefix on the selector
			selector = selector.replace(/^LIVE:\s*/g, "");
			var isRootSelector = this._isRootSelector(selector);
			selector = this._normalizePartSelector(selector);
			var property;
			if (isRootSelector) {
				property = new Property.Getter(function() {
					return (this.$root ? this.$root.find(selector) : $());
				});
			} else {
				property = new Property.Getter(function() {
					return $(selector);
				});
			}
			Object.defineProperty(this, partName, property);
		},


	//
	//	decorators -- widgets we create and manage automatically
	//

		// decorators is a map of { moduleId => {properties} } to create as decorators for this instance.
		decorators : Property.ProtoMap("decorators"),

		// Iterate through our decorators initializer setting things up.
		initDecorators : function() {
			if (!this.decorators) return;
			this._decorators = [];
			for (var moduleId in this.decorators) {
				var setup = (this.decoratorSetup ? this.decoratorSetup[moduleId] : undefined);
				if (!setup) {
					var className = moduleId.split("/").last();
					setup = {
						defaults : {
							id : this.id + className
						}
					};
				}
				var defaults = setup.defaults || {};

				// get properties from our defaults and from those passed in when creating the widget
				var props = $.extend({}, defaults, this.decorators[moduleId]);

				// expand all props with this widget to "localize" them to this widget instance.
				for (var key in props) {
					var value = props[key];
					if (typeof value === "string") props[key] = value.expand(this);
				}

				// make sure parent and $parent are defined in the properties
				props.parent = props.decoratee = this;
				if (!props.$parent) {
					if (setup.get$parent) 	props.$parent = setup.get$parent.apply(this);
					else					props.$parent = (this.$body || this.$root);
				}
				if (typeof props.$parent === "string") props.$parent = this._findPart(props.$parent);

				// load the module and create the widget on success.
				Module.require(moduleId, function(decoratorClass) {
					var decorator = new decoratorClass(props).draw();
					props.parent._decorators.push(decorator);
					// call the initialization routine if defined
					if (props.initDecorator) props.initDecorator.call(props.parent, decorator);
				}.bind(props));
			}
		},

		updateDecorators : function() {
			if (this._decorators) this._decorators.forEach(function(decorator){decorator.soon("update")});
		},

		clearDecorators : function() {
			if (this._decorators) this._decorators.forEach(function(decorator){decorator.soon("clear")});
		},


	//
	//	html templates
	//
		// map of template name -> <script id='templateId'> for this widget, set up automatically
		templates : null,

		// TODO: recurse up prototype chain?

		// initialize any templates
		initTemplates : function() {
			var templates = {};

			function setEmUp(widget, proto) {
				if (proto.hasOwnProperty("templates")) {
					for (var templateName in proto.templates) {
						var selector = proto.templates[templateName];

						// special case: use "##" to replace with widget.id
						selector = selector.replace(/##/g, "#"+widget.id);
						var $template = $(selector);
						templates[templateName] = $template.text();
						$template.remove();
					}
				}
			}
			Object.recurseUpPrototypeChain(this, setEmUp);
			this.templates = templates;
		},


	//
	//	display / layout
	//

		// show/hide effect, one of "none", "fade", "slideDown"
		effects : ["none", "fade", "slideDown"],
		effect : "none",

		// show/hide effect speed (if effect != "none")
		//	null (400 ms), "fast" (200ms), "slow" (600ms) or a # of milliseconds
		speed : null,

		// Plugins to call immediately after widget.onShowing() is called.
		// Used by mixins or decorators to do something automatically before we start showing.
		onReadyPlugins : new Property.ProtoList("onReadyPlugins"),

		// Plugins to call before widget.onShowing() is called.
		// Used by mixins (eg: oak/lib/ui/Draggable) to do something automatically before we start showing.
		// See `_loadedAndReadyToShow()`.
		onShowingPlugins : new Property.ProtoList("onShowingPlugins"),

		// Plugins to call before widget.onShown() is called.
		// Used by mixins (eg: oak/lib/ui/Draggable) to do something automatically before showing.
		// See `_loadedAndReadyToShow()`.
		onShownPlugins : new Property.ProtoList("onShownPlugins"),

		// Plugins to call before widget.onHiding() is called.
		// Used by mixins (eg: oak/lib/ui/Draggable) to do something automatically before showing.
		// See `hide()`.
		onHidingPlugins : new Property.ProtoList("onHidingPlugins"),

		// Plugins to call before widget.onHidden() is called.
		// Used by mixins (eg: oak/lib/ui/Draggable) to do something automatically before showing.
		// See `hide()`.
		onHiddenPlugins : new Property.ProtoList("onHiddenPlugins"),

		// Plugins to call AFTER widget.update() is called.
		// Used by mixins or decorators to do something automatically when we update.
		// See `update()`.
		updatePlugins : new Property.ProtoList("updatePlugins"),

		// Plugins to call AFTER widget.clear() is called.
		// Used by mixins or decorators to do something automatically when we update.
		// See `clear()`.
		clearPlugins : new Property.ProtoList("clearPlugins"),

		// Call a bunch of `plugins` methods, if defined, with the given `args` array.
		_callPlugins : function(pluginName, args) {
			var plugins = this[pluginName];
			if (!plugins || !plugins.length) return;
			var i = -1, method;
			while (method = plugins[++i]) {
				method.apply(this, args);
			}
		},


		// Show this widget.  Loads it first if necessary.
		//
// TODO: return a promise which will be satisfied when the widget has finished showing???  How?
		//
		// NOTE: don't override this, override on of the following instead:
		//			- widget.onShowing()
		//			- widget.onShown()
		//			- widget.updateLayout()
		show : function() {
			var args = Function.args();
			if (this.isLoaded) {
				return this._loadedAndReadyToShow.call(this, args);
			} else {
				var promise = new $.Deferred();
				var widget = this;
				this.load().done(function() {
									widget._loadedAndReadyToShow.call(widget, args)
										.done(function(){promise.resolveWith(widget)})
										.fail(function(){promise.rejectWith(widget)});
								})
						   .fail(function(){promise.rejectWith(widget)});
				return promise;
			}
		},

		// Widget-level method called right AFTER we've been loaded
		//	and before our onShown() is called and we are shown.
		//	DON'T OVERRIDE THIS -- override on of the included methods instead
		_loadedAndReadyToShow : function(args) {
			this.initialize();

			// call any 'onShownPlugins' from Mixins if necessary.
			this._callPlugins("onShowingPlugins");	// TODO: give this a chance to cancel show?

			// now call our default onShowing method
			this.onShowing.apply(this, args);	// TODO: give this a chance to cancel show?

			this.update.apply(this, args);
			this._setUpEvents();
			this.isShowing = true;

			var widget = this;
			return this._showMainElement.apply(this, args)
					.done(function() {
						// call our onShown method.
						widget.onShown.apply(widget, args);

						// call any 'onShowingPlugins' from Mixins if necessary.
						widget._callPlugins("onShownPlugins");

						widget.updateLayout.apply(widget, args);
					});
		},

		// Hide this widget.
		// NOTE: don't override this, override on of the following instead:
		//			- widget.onHiding()
		//			- widget.onHidden()
		hide : function() {
			var args = Function.args();
			// call any 'onHidingPlugins' from Mixins if necessary.
			this._callPlugins("onHidingPlugins");		// TODO: give this a chance to cancel hide?
			this.onHiding.apply(this, args);		// TODO: give this a chance to cancel hide?
			this.isShowing = false;
			this._tearDownEvents();

			var widget = this;
			return this._hideMainElement().done(function(){
				// call any 'onHiddenPlugins' from Mixins if necessary.
				widget._callPlugins("onHiddenPlugins");
				// call our onHidden method.
				widget.onHidden.apply(widget, args);
			});
		},

		// Toggle visibility of this widget.
		//	Pass a boolean to set it explicitly one way or the other
		toggle : function(shouldShow) {
			if (typeof shouldShow !== "boolean") shouldShow = !this.isShowing;
			if (shouldShow) return this.show.apply(this, arguments);
			else			return this.hide.apply(this, arguments);
		},

		// Your callback to do something AFTER we've been completely loaded/initialized,
		//	but BEFORE you are shown().
		//
		// This should only be called once per widget!
		onReady : function() {},

		// Callback when we're about to be shown (BEFORE our show visual effect fires).
		//	NOTE: we should have our HTML set up, but we may not be fully visible in the DOM
		//			so you shouldn't do layout calculations here -- use onShown() or updateLayout() for that
		onShowing : function() {},

		// Called whenever it's time for us to update our HTML,
		//	either 'cause we're being drawn for the first time,
		//	or 'cause our data has changed or something.
		// NOTE: you probably want to override `updateContents()` rather than update.
		update : function() {
			this.clearSoon("update");
			this.updateContents.apply(this, arguments);
			this.updateDecorators(this, arguments);
			this._callPlugins("updatePlugins", arguments);
		},

		// Called before we're shown, to give us a chance to update our HTML
		//	based on some parameters passed in to widget.show()
		updateContents : function() {},

		// Callback when we've finished being shown (AFTER our show visual effect fires).
		onShown : function() {},

		// Called when the screen geometry changes and the widget is visible,
		//	like when you're initially shown.  You can depend on the widget to be sizable here.
		updateLayout : function() {},

		// Callback when we're to be hidden, but BEFORE hide visual effect fires
		onHiding : function() {},

		// Callback when we've just been completely hidden (eg: visual effect has finished)
		onHidden : function() {},


		// Clear our presentation, eg if we don't have any data to show, etc.
		// Called when we should clear our contents (in a more-or-less ad hoc fashion).
		// NOTE: you probably want to override clearContents() rather than this.
		clear : function() {
			this.clearSoon("clear");
			this.clearContents();
			this.clearDecorators();
			this._callPlugins("clearPlugins");
		},

		// Actually clear our contents out.
		// Default does nothing, you probably want to override
		clearContents : function() {},


		// Show our main element.
		//	Returns a promise which will be resolved when any animation finishes.
		_showMainElement : function() {
			var promise = new $.Deferred();
			switch (this.effect) {
				case "fade":
					return $.when(this.$root.fadeIn(this.speed));

				case "slideDown":
					this.$root.css("display", "block");
					return $.when(this.$root.animate({top:0}, this.speed));

				default:
					this.$root.show(); return (new $.Deferred()).resolve();
			}
		},

		// hide our main element
		_hideMainElement : function() {
			if (this.$root) {
				switch (this.effect) {
					case "fade":
						return $.when(this.$root.fadeOut(this.speed));

					case "slideDown":
						return $.when(this.$root.animate({top:-1.5*(this.$root.height())}, this.speed));

					default:
						this.$root.hide();
				}
			}
			return (new $.Deferred()).resolve();
		},

	//
	//	hash/title stuff
	//
//TODO: MOVE THIS OUT OF WIDGET AND INTO SOME COMMON MIXIN FOR 'Page' AND 'Overlay' ETC?

		// If your widget is set up as a hash responder, this will be called on your instance.
		//	If your display changes based on parameters, do your thing here!
		onHashChanged : function(param1, param2, etc) {},

	//TODO: GET RID OF THIS AND USE A GETTER INSTEAD???
		getHash : function() {
			return "override "+this.getId+"_.getHash()";
		},

		updateHash : function() {
			UI.setHash(this.getHash());
		},

	//TODO: GET RID OF THIS AND USE A GETTER INSTEAD???
		getPageTitle : function() {
			return "OVERRIDE .getPageTitle() FOR YOUR PAGE/WIDGET";
		},

		updatePageTitle : function() {
			UI.setPageTitle(this.getPageTitle());
		},

	//TODO: GET RID OF THIS AND USE A GETTER INSTEAD???
		getWindowTitle : function() {
			return this.windowTitle || "Catalog Spree";
		},

		updateWindowTitle : function() {
			UI.setTitle(this.getWindowTitle());
		},

	//
	//	event handling
	//


		// Set of events to be set up/torn down as we're shown/hidden.
		//	Format:
		//		events : [
		//			{selector:"#MyThing", event:"click", handler:function anonymousHandler(){}},
		//			{selector:"#MyThing", event:"mousedown", handler:"nameOfSomeMethodDefinedOnMe"},
		//			...
		//		]
		//
		// See addEvent()
		events : new Property.ProtoList("events"),

		// map of keys => method to call.  See "oak/lib/ui/KeyMap"
		keyMap : new Property.ProtoList("keyMap"),

		// Method to call on this object periodically when the window is resized.
		onWindowResized : undefined,

		// if this is true when we're shown, a global click OUTSIDE our element will hide us
		// TODOC
		hideOnOutsideClick : false,

		// Set up all "events" defined at the widget level OR on any of its prototypes.
		_setUpEvents : function() {
			// bail if our events have already been hooked up
			if (this._hookedEvents) return;

			// get all events from us and from our superclasses, with our events added LAST
			//	(NOTE: there may be some duplicates in this...)
			var events = this.events;
			if (events) {
				events.forEach(function(options) {
					this.addEvent(options);
				}.bind(this));
			}

			// if the we wants to be notified of window resize, set that up
			if (this.onWindowResized) UI.addRezizeWatcher(this);

			// if we want to be hidden when the mouse goes up outside of us, set that up
			if (this.hideOnOutsideClick) UI.hideOnClickOutsideOf(this);

			// if we have a keyMap, set that up now
			if (Class.KeyMap && this.keyMap) {
				// NOTE: we create keyMaps as protoMaps (objects),
				//		 convert to a proper KeyMap the first time we set the keymap up.
				// NOTE: we pass ourselves as the scope for the keymap, so write your actions appropriately.
				if (!this._keyMap) this._keyMap = new Class.KeyMap(this.keyMap, this);
				UI.addKeyMap(this._keyMap);
			}
		},

		_tearDownEvents : function(widget) {
			if (!widget) widget = this;
			if (widget._hookedEvents) {
				widget._hookedEvents.forEach(function(options) {
					widget.removeEvent(options);
				});
				delete widget._hookedEvents;
			}

			// stop watching window resize as well
			UI.removeResizeWatcher(this);

			// if we want to be hidden when the mouse goes up outside of us, set that up
			if (this.hideOnOutsideClick) UI.clearHideOnClick(this);

			// if we have a keyMap, remove it
			if (Class.KeyMap && this._keyMap) UI.removeKeyMap(this._keyMap);
		},

		// add an event to our events list
		addEventDescriptor : function(options) {
			if (!this.hasOwnProperty("events")) this.events = [];
			this.events.push(options);

			// if we've already set up our events, add this one now
			if (this._hookedEvents) this.addEvent(options);
		},


		// Add an event, in a way where it will be unhooked in _tearDownEvents().
		//	Options is an object with the following:
		//		- selector		: css selector to bind to
		//		- event			: event type (automatically namespaced with our id)
		//		- scope			: scope object for handler (defaults to this widget)
		//		- handler		: function or name of a method of this object to call
		//						: handler will be called as:   handler(event, $(event.currentTarget))
		//
		// TODO: transform mouse events to tap events!
		//
		addEvent : function(options) {
			// copy the options so we can tweak them without messing up anything
			options = Property.extend({}, options);

			// figure out if the event applies only to a specific selector
			if (typeof options.selector === "string") {
				var selector = options.selector;

				// if the selector starts with $, use the name of one of our parts {}
				if (selector.startsWith("$")) {
					// special case "$root" since that's not set up as a part.
					if (selector == "$root") selector = "#"+this.id;
					else 					 selector = this.parts[selector];
					selector = selector.replace(/LIVE:/g, "");
				}
				// if select starts with "## ", set the "hooked.root" to our root element
				if (selector.startsWith("## ")) {
					options.$root = this.$root;
					selector = selector.replace(/## /g, "");
				}
				// otherwise normalize "##" to select the id of this widget
				else if (selector.contains("##")) {
					// normalize "##" to the id of this widget
					selector = selector.replace(/##/g, "#"+this.id);
				}
//console.info(this, selector);
// TODO: make the event off our our $root element, rather than a global scope ???

				// if selector starts with ":", it's a forward reference to a UI component
				//	which isn't defined when the events array was set up
				//	(but should be defined now)
				if (selector.startsWith(":")) {
					selector = selector.substr(1);
					var thing = eval(selector);
					if (!thing) {
						console.error(this,".addEvent(",options,"): can't find UI."+id);
						return;
					} else {
						selector = thing;
					}
				}
//console.warn(this, options.event, options.selector, "'",selector,"'", options.handler);
				options.selector = selector;
			}

			// default the scope to us
			if (!options.scope) options.scope = this;

			// get the UNBOUND handler, looking it up on the scope object if necessary
			var handler = options.handler;
			// normalize the handler
			if (typeof handler === "string") handler = options.scope[handler];
			if (typeof handler !== "function") {
				return console.warn("Method '"+options.handler+"' not found when hooking up "+options.event+" for: \n",this);
			}
			options.handler = handler;

			// get the bound version of the handler which receives event and currentTarget arguments
			options.boundHandler = function addEventBoundHandler(event) {
				var args = [event, $(event.currentTarget)].concat(Function.args());
				handler.apply(options.scope, args);
			};

			// hook it up

			// if we've got a string selector, use delegation to hook things up
			if (typeof options.selector === "string") {
				// default to the document if we're not attaching to our $root element
				var $root = options.$root || $(document);
				$root.on(options.event, options.selector, options.boundHandler);
			}
			// if the selector is not a string, it's a reference to another object
			else if (options.selector) {
				$(options.selector).on(options.event, options.boundHandler);
			}
			// otherwise define directly on our $root
			else {
				this.$root.on(options.event, options.boundHandler);
			}

			// remember so we can unhook it later
			if (!this._hookedEvents) this._hookedEvents = [];
			this._hookedEvents.push(options);
		},

		// Remove an event set up from addEvent()
		removeEvent : function(options) {
			// if we've got a selector, use delegation to hook things up
			if (typeof options.selector === "string") {
				// default to the document if we're not attaching to our $root element
				var $root = options.$root || $(document);
				$root.off(options.event, options.selector, options.boundHandler);
			} else if (options.selector) {
				$(options.selector).off(options.event, options.boundHandler);
			} else {
				this.$root.off(options.event, options.boundHandler);
			}
		},


	//
	//	preferences set directly on the widget
	//
		preference : function(key, value) {
			if (key == null) key = "";
			key = this.id + "." + key;
			if (arguments.length == 1) return UI.preference(key);
			return UI.preference(key, value);
		},

	},

//
//	static methods (so we can treat Widget as a singleton as well)
//
	{

//TODO: refactor directly onto Widget as "widgetClassNames" ???
		getWidgetClassNames : function() {
			var protos = Object.getPrototypeChain(this), proto;
			var names = [];
			while ((proto = protos.shift())) {
				if (proto === this) continue;
				if (proto.constructor.id) names.push(proto.constructor.id);
				// stop when we get to Widget
				if (proto === Widget.prototype) break;
			}
			return names.join(" ");
		},

		// anything that matches any of these tags is considered a "widget" by initIncludes()
		widgetElementSelector : "widget,include,message",

		// initialize any widgets present under an HTML root
		initIncludes : function($root) {
			// if we're not looking at a jQuery vector, forget it
			if (!$root.find) return console.warn("Widget.initIncludes(",arguments,"): called on non-jQuery object");

	// TODO: we should be looking in the root for this, no?
			// remove any elements in the page with a 'browser' attribute
			//	that doesn't correspond to a Browser property
			$("[browser]").each(function(i, element) {
				var $element = $(element);

				var show = $element.attr("browser").split(" ").every(function(type) {
					if (type.charAt(0) === "!") {
						return Browser.is[type.substr(1)] !== true;
					} else {
						return Browser.is[type] === true;
					}
				});
				if (show === false) $element.remove();
			});

			// handle any top-level widgets
			$root.filter(Widget.widgetElementSelector).each(Widget._attachWidgetElement);

			// handle any nested widgets
			$root.find(Widget.widgetElementSelector).each(Widget._attachWidgetElement);
		},

		// hook up a <widget> or <include> element from somewhere
		_attachWidgetElement : function (index, element) {
			var $widget = $(element);
			var tagName	= element.tagName.toLowerCase();

			// process a <message> tag by substituting the appropriate message dictionary value
			if (tagName === "message") {
				var messageName = $widget.text();
				var message = Messages.get(messageName) || "UNKNOWN MESSAGE '"+messageName+"'";
				$widget.replaceWith(message);
				return;
			}

			var attrs = $widget.attrs();

			// skip any widgets which have already been processed
			if (attrs.__attached__) return;
			// and remember that they've been processed already
			$widget.attr("__attached__", "yes");

			var id 		= attrs.id,
				load	= attrs.load,
				src		= attrs.src  || (id ? UI.appDir + id : null),
				type	= attrs.type || (tagName == "widget" ? "Widget" : null)
			;

			// if a widget with that id already exists, complain!
			if (id && UI[id]) {
				console.error("Attempted to create 2nd widget with id '"+id+"' from element", element);
				return;
			}

			// if no widget type specified, this is a straight include
			if (type == null) {
				if (src) {
					if (src.contains(".js")) {
						Module.loadScript(src);
					} else {
						setTimeout(function() {
							API.xmlLoader(src, {dataType:"ohtml"}).done(function($loadedRoot) {
								// replace the <include> with what we loaded
								$widget.replaceWith($loadedRoot);
								// parse any widget tags in there
								Widget.initIncludes($loadedRoot);
							});
						}, 100);
					}
				} else {
					console.error("simple <include> specified without a src");
				}
			}

			// we should construct a widget
			else {
				var Constructor = Class[type];
				if (typeof Constructor != "function") throw "Don't understand type '"+type+"' to initialize widget '"+id;

				var widget = new Constructor({
						id		: id,
						src 	: src,
						$root	: $widget,
						isLoaded: load == null
					});

				// if widget.id was specified, make a reference to it from the UI object
				if (id) UI[id] = widget;

				// if a hash responder is specified, hook that up
				var hash = attrs.hash;
				if (hash) {
					widget.hash = UI.addHashResponder(widget, hash);
				}

				// set up any widget-initializer properties (start with "widget-").
				//	See:   $.fn.copyAttributesTo() in jQuery-extensions.
				$widget.copyAttributesTo(widget, true, "widget-");

				if (load) {
					// if we're supposed to load dynamically right now, do it!
					if (load == "now") {
//debug
window.it = widget;
						setTimeout(function(){
							widget.show();
						}, 100);
					}
				} else {
					widget.initialize();
				}
			}
		}

	});	// end new Class("Widget")

	return Class.Widget;
});	// end define("oak/lib/ui/Widget")
