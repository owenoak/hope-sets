/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/*
	Master UI Controller object.
 */


Module.define("oak/lib/ui/UI",
"oak/lib/core/Singleton,oak/lib/ui/Widget,oak/lib/ui/Panel,oak/lib/ui/Page,oak/lib/ui/Modal",
function(Singleton, Widget, Panel, Page, Modal)
{
	//
	//	Create the UI singleton
	//
	new Singleton("UI", {
		mixins : "Soonable,Debuggable,Bindable",

		// app name for window title
		// 	TODO: You MUST set this per application!
		appName : "SET UI.appName!",

		// Directory where application files live
		// 	TODO: You MUST set this per application!
		appDir : "TODO_SET_UI_APPDIR",

		// NAME OF the default page to show on first run of the app
		// 	TODO: You MUST set this per application!
		defaultPage : "TODO_SET_DEFAULT_PAGE_IN_UI.JS",

		// list of permissions we check for in this app
		// see UI.initPermissions()
		permissions : undefined,

		// map of {sectionName => PAGE ID} for default pages to show for each section.
		//	NOTE: The 'default' page may change as they navigate to the different sections.
		//			See UI.onPageChanged()
		// 	TODO: You MUST set this per application!
		sections : {},

		// POINTER TO the current top-level page we're showing
		page : null,

		// NAME of the current section we're displaying
		sectionName : null,


		// called on dom ready
		initializeBodyTags : function() {
			this.initIncludes($("body"));

			// set up the main UI container
			this.$root = $("ui");
		},


		// reload the top-level app page
		reload : function(eraseContext) {
			if (eraseContext) {
				var href = window.location.href;
				if (href.contains("#")) href = href.substr(0, href.indexOf("#"));
				if (href.contains("?")) href = href.substr(0, href.indexOf("?"));
				window.location.replace(href);
			} else {
				window.location.reload();
			}
		},


		// Initialize the entire UI.
		//	You should not override this, implement a "loadInitialData()" instead.
		initialize : function() {
			if (!UI.domReady) {
				console.info("UI.initialize(): Deferring UI.initialize() because dom is not ready");
				$(document).ready(this.initialize.bind(this));
				return;
			}
			if (UI.debug) console.group("UI.initialize()");

			// initialize <widget> and <include> tags in the HTML
			this.initializeBodyTags();

			// observe the "pageChanged" event
			$(UI).on("pageChanged", this.onPageChanged.bind(this));

			// observe custom events
			this.setupUIEvents();

			// load startup data specific to this app
			//	then call UI.onReady() once all that is done.
			this.loadStartupData().done(this.onReady.bind(this))
								  .fail(this.onReadyError.bind(this));


			// left and right sidebar stuff
			UI.toggleClass("showLeftSidebar", UI.preference("showLeftSidebar") === true);
			UI.toggleClass("showRightSidebar", UI.preference("showRightSidebar") === true);

			// default zoom scale
			if (UI.preference("zoomScale") === undefined) UI.preference("zoomScale", 1);
			if (Browser.is.nativeapp) NativeApp.setWindowScale(UI.preference("zoomScale"));

			// fire an "initialized" method which things can use to watch for UI initialzation
			$(UI).trigger("initialized");

			if (UI.debug) console.groupEnd();
		},

		// Set up any global UI observations here.
		//	NOTE: this is called BEFORE your startup data is loaded.
		setupUIEvents : function() {},


		// Load() any files you'll need before the app can really start.
		// 	- MUST return a promise which resolves after ALL required files are loaded.
		//	- onReady() will be called once your files are all loaded.
		loadStartupData : function() {
			return $.Deferred().resolveWith(this);
		},

		// All your startup data is ready to go!
		onReady : function() {
			console.warn("Your UI is ready to go!");
		},

		// An input field was focused -- override this to do something generic.
		onFieldFocused : function(e, $field) {},

		// An input field was blurred -- override this to do something generic.
		onFieldBlurred : function(e, $field) {},


		// User object permissions have changed.
		// Called from User.initPermissions()
		onPermissionsChanged : function() {
			if (this.permissions) {
				this.permissions.forEach(function(name) {
					if (User.hasPermission(name)) 	UI.addClass(name);
					else							UI.addClass(name+"-NO");
				});
			}
			if (User.isSuperUser())	UI.addClass("superuser");
		},

	//
	//	generic Page stuff
	//

		// the top-level page was changed
		onPageChanged : function(event, newPage, oldPage) {
			// remember the new page as our page
			this.page = newPage;
			this.preference("page", newPage.id);

			// set a "page-<id>" class on the html element for styling
			UI.removeClassesStartingWith("page-")
					 .addClass("page-"+newPage.id);

			// remember the new page's section
			var sectionName = newPage.section || "";
			this.sectionName = sectionName;
			this.preference("section", sectionName);

			// set a "section-<section>" class on the html element for styling
			UI.removeClassesStartingWith("section-");
			if (sectionName) {
				UI.addClass("section-"+sectionName);
				// remember that we were last displaying this page in this section
				this.sections[sectionName] = newPage.id;
			}

			// if we have any app menus defined, have them initialize and update the menus in a little bit
			if (Class.AppMenu) {
				setTimeout(function() {
					Class.AppMenu.initGlobalKeyHandling();
					Class.AppMenu.updateMenuBar();
				}, 0);
			}
		},

		// set the initial page by examining the hash URL.
		initPageFromHash : function() {
			// hash mode ???
			if (window.location.hash) {
				if (UI.debugHash) console.info("UI.onReady():  location.hash is set -- will determine location via hash");
				UI.onHashChanged();

			}
			// normal mode
			else {
				// use the page set in prefereces, providing default if no pref set
				sectionId = this.defaultPage;
				console.info("UI.onReady():  going to page ", sectionId, " from preferences");

				var page = this.getPageForSection(sectionId);
				// if page not found, go back to default page
				if (!page) {
					console.warn("Couldn't find page ", sectionId, " showing default page ", this.defaultPage);
					sectionId = this.defaultPage;
					page = this.getPageForSection(sectionId);
				}
				if (page && page.show) page.soon("show");
			}
		},

		initIncludes : function($root) {
			if (!$root) $root = UI.$root;
			return Widget.initIncludes($root);
		},

		getPageForSection : function(sectionName) {
			if (!sectionName) return UI.page;
			if (typeof sectionName === "string") return UI[sectionName];
			return sectionName;
		},


	//
	//	section stuff
	//

		// Show the current "default" page for a given section.
		showSection : function(sectionName) {
			var pageId = this.sections[sectionName];
			if (!pageId) return console.error("UI.showSection("+sectionName+"): don't have a default page for section!");
			var page = UI[pageId];
			if (!page) return console.error("UI.showSection("+sectionName+"): can't find page '"+pageId+"'!");
			page.show();
		},

	//
	//	show/hide sidebars
	//
		toggleLeftSidebar : function(showIt) {
			showIt = (typeof showIt !== "boolean" ? !UI.preference("showLeftSidebar") : !!showIt);
			UI.preference("showLeftSidebar", showIt);
			UI.toggleClass("showLeftSidebar", showIt);
		},

		toggleRightSidebar : function(showIt) {
			showIt = (typeof showIt !== "boolean" ? !UI.preference("showLeftSidebar") : !!showIt);
			UI.preference("showRightSidebar", showIt);
			UI.toggleClass("showRightSidebar", showIt);
		},

	//
	//	manipulate page-level class attributes (on the HTML element)
	//
		$html : $("html"),
		hasClass : function(className, turnOn) {
			return UI.$html.hasClass(className);
		},

		addClass : function(className) {
			UI.$html.addClass(className);
			return this;
		},

		removeClass : function(className) {
			UI.$html.removeClass(className);
			return this;
		},

		toggleClass : function(className, turnOn) {
			UI.$html.toggleClass(className, turnOn);
			return this;
		},

		// Remove all classes which start with a given prefix.
		removeClassesStartingWith : function(prefix) {
			UI.$html.removeClassesStartingWith(prefix);
			return this;
		},



//
//	Event logging interface.
//	Default is to ignore event logging, your particular UI instance might do something else.
//
	logEvent : function(eventUrl) {},


	//
	//	window resize behavior:
	//		- If you have a widget that wants to be notified when the window is resized
	//			(eg: so it can move or otherwise adjust its layout)
	//			implement a   widget.onWindowReized   handler in the widget.
	//
	//		- These will automatically be called periodically as the window is resized.
	//
		_resizeWatchers : [],
		onWindowResized : function() {
			UI.clearSoon("onWindowResized");
			this._resizeWatchers.forEach(function(watcher) {
				watcher.onWindowResized();
			});
		},

		addRezizeWatcher : function(watcher) {
			if (watcher && typeof watcher.onWindowResized === "function") {
				UI._resizeWatchers.append(watcher);
			}
		},

		removeResizeWatcher : function(watcher) {
			UI._resizeWatchers.remove(watcher);
		},

	//
	//	global notice dialog
	//
		showNotice : function(message, modal) {
			//don't use the auto resize code for notices
			UI.Notice.autoResize = false;
			UI.Notice.message = message;
			UI.Notice.setModal(!!modal);
			UI._setNoticeHTML(message);
			UI.Notice.$body.find(".message").html(message);
			UI.Notice.show();
		},

		showModalNotice : function(message) {
			UI.showNotice(message, true);
		},

		hideNotice : function(message) {
			if (message && UI.Notice.message && UI.Notice.message != message) return;
			UI.Notice.message = null;
			// hide the notice dialog and reset its html when done
			UI.Notice.hide().done(function() {
				if (!UI.Notice.isShown) {
					UI._setNoticeHTML("");
				}
			});
		},

		flashNotice : function(message, delay) {
			if (delay == null) delay = 1000;

			UI.showNotice(message, false);
			setTimeout(function() {
				UI.hideNotice(message);
			}, delay);
		},
		_setNoticeHTML : function(html) {
			if (!html) html = "";
			UI.Notice.$body.find(".message").html(html);
		},

	//
	//	breadcrumbs
	//

		// list is an array of of [name,hash] tuples
		setBreadcrumbs : function(list) {
			var last = (list.length - 1), title, url;
			var crumbs = list.map(function(item, index) {

				if (typeof item == "string") {
					title = item;
					url = null;
				} else {
					title = item[0];
					url   = item[1];
				}
				var className = ["crumb"];
				var onclick = "";
				var contents = title.split("|").map(function(segment) {
					if (segment == "STUB") {
						className.append("stub");
					} else if (segment == "LOGO-BUG") {
						className.append("logo-bug");
						return "<div class='logo-text-small'></div>";
					} else if (segment == "LOGO-BUG-TITLE") {
						className.append("logo-bug");
						return "<div class='logo-text-small'></div>";
					} else if (segment == "LOGO-TYPE") {
						className.append("logo-text");
						return "<div class='logo-text-small'></div>";
					} else {
						className.append("text");
						return "<label>"+segment+"</label>";
					}
				}, this).join("");

				if (index == last) className.append("end");

				// if no url, we won't show a link indicator
				if (!url) {
					className.append("noUrl");
				}
				// if just an empty anchor, ignore
				else if (url && url == "#") {}
				// show a menu
				else if (url && url.startsWith("MENU:")) {
					className.append("menu");
					contents += "<div class='menuArrow'></div>";
					onclick = "onclick='UI."+ url.substr(5) + ".toggle()'";
				}
				// inline script
				else if (url && url.startsWith("SCRIPT:")) {
					onclick = "onclick='"+ url.substr(7) + "'";
				}
				// regular URL
				else {
					onclick = "onclick='window.location = \""+url+"\"'";
				}
				return "<button class='"+className.join(" ")+"' "+onclick+">" + contents + "</button>";

			}, this);
			crumbs = crumbs.join("");
			$("#breadcrumbs").html(crumbs);
		},

		// Set the window title.
		//	Format is:  Catalog Spree - <title>
		setWindowTitle : function(args) {
			if (arguments.length > 1) args = Function.args();
			else if (typeof args === "string") args = [args];
			var name = this.appName + " • " + args.join(" ");
			document.title = name;
		},


		// Set the page title (in the top toolbar)
		$pageTitle : $("#PageTitle"),
		setPageTitle : function(args) {
			if (arguments.length > 1) args = Function.args();
			else if (typeof args === "string") args = [args];
			var name = args.join(" ");
			UI.$pageTitle.html(name);
		},

		// increase window zoom level
		zoomIn : function() {
			var zoomScale = UI.preference("zoomScale") || 1;
			zoomScale += 0.1;
			this.setZoom(zoomScale);
		},

		// decrease window zoom level
		zoomOut : function() {
			var zoomScale = UI.preference("zoomScale") || 1;
			zoomScale -= 0.1;
			this.setZoom(zoomScale);
		},

		zoomReset : function() {
			this.setZoom(1);
		},

		setZoom : function(zoomScale) {
			if (Browser.is.nativeapp) NativeApp.setWindowScale(zoomScale);
			UI.preference("zoomScale", zoomScale);
		},

	//debug

		toString : function(){return "[UI]"}

	});	// end UI.extend()






	//
	// Hash manipualtion on the UI object
	//

	UI.extend({
	//
	//	hash change stuff
	//
		// set to true to print debug stuff while we're initializing via the url hash
		debugHash : false,

		// Current hash we think we're set to right now.
		currentHash : undefined,

		// Registry of hash roots to the Widgets whose onHashChanged() should be called when the hash changes.
		//	This allows us to decentralize the hash management.
		//	Use UI.addHashResponder() to set up hash responders.
		//
		//	NOTE: the page will be load()ed before it's onHashChanged is changed.
		hashRegistry : {},

		// 	The window.hash has change,
		//		- either from being explicitly set (via setHash)
		//		- or from the back button
		// 	Figuure out what to do.
		//
		//	Returns true if we've handled the event, or false if we couldn't figure out what to do.
		onHashChanged : function(event) {
			var windowHash = window.location.hash;
			// bug 500:  facebook stupidly puts URL attributes AFTER the hash
			var ampIndex = windowHash.indexOf("&");
			if (ampIndex > -1) windowHash = windowHash.substring(0, ampIndex);
			if (windowHash == this.currentHash) {
				if (this.debugHash) console.debug("onHashChanged: no change ("+windowHash+")");
				return true;
			}
			if (this.debugHash) {
				console.group("onHashChanged:");
				console.info("Current: ", this.currentHash);
				console.info("Window : ", window.location.hash.substring(1));
			}

			// find the longest hash responder who can handle this hash
			var responder = null, responderName = "";
			for (var key in this.hashRegistry) {
				if (!windowHash.startsWith(key)) continue;
				if (key.length > responderName.length) {
					responderName = key;
					responder = this.hashRegistry[key];
				}
			}

			// if no responder found, default to the home page
			if (!responder) {
				console.info("No responder set for "+windowHash);
				responder = UI[UI.defaultPage];
			}

			// load the responder first and then call its onHashChanged
			setTimeout(function() {
			var params = windowHash.split("/");
			responder.load().done(
					function() {
						responder.onHashChanged.apply(responder, params);
					});
				}, 10);
			if (this.debugHash) console.groupEnd();
		},

		// Change the window.hash (eg: when navigating to a new page).
		// Pass `true` to `replace` to replace the current hash with this one,
		//		ie: going "back" will go back to the `newHash` rather than the current hash.
		// TODO: `responder` seems to be unused, remove it???
		setHash : function(newHash, responder, replace) {
			if (!newHash.startsWith("#")) newHash = "#" + newHash;
			if (this.debugHash) {
				console.group("setHash(",newHash,replace,")");
				console.info("Current: ", this.currentHash);
				console.info("Window : ", window.location.hash);
			}
			this.currentHash = newHash;
			// strip old hash path off of location
			var oldLocation = (""+window.location), newLocation;
			if (oldLocation.contains("#")) {
				newLocation = oldLocation.substr(0, oldLocation.indexOf("#"));
			} else {
				newLocation = oldLocation;
			}
			newLocation += newHash;
			if (newLocation !== oldLocation) {
				if (replace) {
					if (this.debugHash) console.info("REPLACING HASH WITH: " + newHash);
					window.location.replace(newLocation);
				} else {
					if (this.debugHash) console.info("SETTING HASH TO: " + newHash);
					window.location = newLocation;
				}
			} else {
				if (this.debugHash) console.info("No need to update window.hash");
			}
			if (this.debugHash)	console.groupEnd();
			return newHash;
		},

		// Have the current page update the hash.
		updateHash : function() {
			if (!UI.page) return;
			UI.setHash(UI.page.getHash());
		},

		// Register some object (eg: a page) to respond onHashChanged
		//	when the new hash has a certain root (up to the first slash).
		//	- hashRoots is a comma-separated string or an array of strings
		//	- return the first hash in the list, which should be considered
		//		the "canonical" hash for the responder.
		addHashResponder : function(who, hashRoots) {
			if (typeof hashRoots === "string") hashRoots = hashRoots.split(",");
			hashRoots.forEach(function(hashRoot) {
				if (UI.hashRegistry[hashRoot]) {
					console.warn("UI.addHashResponder('"+hashRoot+"',",who,"): WARNING: "
							+ "there is already a responder for this hashroot (",UI.hashRegistry[hashRoot]+")");
				}
				UI.hashRegistry[hashRoot] = who;
			});
			return hashRoots[0];
		},
	});


	//
	//	"preferences" -- values stored conveniently in localStorage for use in your app
	//
	UI.extend({
		// prefix appended to all "preference" names automatically
		//	Override with a distinct string in your app's UI.js object
		_prefRoot : undefined,

		// Get or set a preference.
		//	Pass with one argument to get the value.
		//	Pass two arguments to set the value.
		//	Pass null as second argument to clear.
		preference : function(prefName, value) {
			if (UI._prefRoot === undefined) throw "Attempting to call UI.preference() before UI initialized";
			prefName = UI._prefRoot + prefName;
			return Browser.preference.apply(Browser, arguments);
		},

		// Clear ALL application "preferences" from localStorage
		clearAllPrefs : function(skipDebugPrefs) {
			this.clearPrefs("", skipDebugPrefs);
		},

		// Clear all application preferences that start with a given prefix from localStorage
		clearPrefs : function(prefix, skipDebugPrefs) {
			if (prefix == null) prefix = "";
			prefix = UI._prefRoot + prefix;
			Browser.clearPrefs(prefix, skipDebugPrefs);
		}
	});

	//
	// Global event manipulation
	//

	UI.extend({
	//
	//	hideOnClickOutsideOf:
	//
		//	We often have things, like Menus or Popovers, which should be hidden
		//	  if the mouse goes up somewhere on the screen OTHER THAN THE ITEM ITSELF.
		//	Call    UI.hideOnClick(yourThing)  		to set the behavior up.
		//
		//	NOTE that this is set up for you for some Widget classes (like Menu or Popover).
		_widgetsToHideOnClick : [],
		hideOnClickOutsideOf : function(widget) {
//console.info("Adding ",widget);
			UI._widgetsToHideOnClick.add(widget);
		},

		clearHideOnClick : function(widget) {
			if (widget == null) {
//console.warn("clearing ",UI._widgetsToHideOnClick);
				UI._widgetsToHideOnClick = [];
			}
			else {
				UI._widgetsToHideOnClick.remove(widget);
//console.warn("Removing ",widget);
			}
		},

		_onGlobalMouseUp : function(event) {
			var widgets = UI._widgetsToHideOnClick;
			event = $.event.fix(event);
			// ignore right click
			if (event.button !== 0) return;
			if (widgets.length === 0) return;

			// figure out of the event happened in one of our "hideOnClick" widgets
			var widget, i = -1, isContained = false;
			while (!isContained && (widget = widgets[++i])) {
				if (widget.$root.containsEvent(event)) isContained = true;
			}

			// if not, hide all the hideOnClick widgets
			if (!isContained) {
//console.warn("not contained ", widgets);
				setTimeout(function() {
//console.debug("hiding ",widgets, widgets.getProperty("isShowing"));
					i = -1;
					while ((widget = widgets[++i])) {
						if (widget && widget.isShowing) widget.hide();
					}
					// clear ALL widgets out of the hideOnClick list
					UI.clearHideOnClick();
				}, 100);
			} else {
//console.warn("contained");
			}
		},
	});


	//
	// Global clickmask
	//	TOOD: move into UI-clickmask?
	//

	UI.extend({
		showClickMask : function(target) {
			this.clickMaskTarget = target;
			if (!UI.$clickMask) {
				UI.$clickMask = $("<div class='OverlayMask'/>");
				UI.$clickMask.on("click", this.onClickMaskClick.bind(this));
				$("body").append(UI.$clickMask);
			}
			UI.$clickMask.bringToFront().show();
			UI.addClass("showingClickMask");
		},

		hideClickMask : function() {
			delete this.clickMaskTarget;
			if (UI.$clickMask) UI.$clickMask.hide();
			UI.removeClass("showingClickMask");
		},

		onClickMaskClick : function(event) {
			if (this.clickMaskTarget && this.clickMaskTarget.onMaskClick) this.clickMaskTarget.onMaskClick(event);
		}
	});

	//
	//	alert(), confirm() variants which you can style.   (see Alert.js, Confirm.js)
	//
	//	NOTE: these stubs get replaced by routines in the above .js files when they're loaded,
	//			so you can call these directly without explicitly including Alert or Confirm, etc.
	//
	//	TOOD: move into UI-alert etc?
	UI.extend({
		// Show a styled alert().
		// Returns a promise which will be resolve()d when they press OK.
		// @message is the message to show.
		// @okButtonTitle is the title of the OK button.  (Default: "OK").
		alert : function(message, okButtonTitle) {
			if (!UI.Alert) {
				UI.Alert = new Panel({
					mixins : "Modal",
					id : "Alert",
					bottomToolbarHTML : "<button class='okButton shiny default important'>OK</button>",
					updateContents : function(message, okButtonTitle) {
						this.asPanel("updateContents");
						this.$body.html(message||"alert???");
						this.$okButton.html(okButtonTitle||"OK");
					},
					// map a mask click to "OK" since we don't have a cancel button.
					onMaskClick : function(event) {
						this.onOK(event);
					}
				}).draw();
			}
			return UI.Alert.showModal(message, okButtonTitle);
		},

		// Show a styled confirm(), with OK and Cancel buttons.
		// Returns a promise which will be resolve()d if they press OK, or reject()ed if they Cancel.
		// @message is the message to show.
		// @okButtonTitle is the title of the OK button.  (Default: "OK").
		// @cancelButtonTitle is the title of the cancel button.  (Default: "Cancel").
		confirm : function(message, okButtonTitle, cancelButtonTitle) {
			if (!UI.Confirm) {
				UI.Confirm = new Panel({
					mixins : "Modal",
					id : "Confirm",
					bottomToolbarHTML : "<button class='cancelButton shiny'>Cancel</button>"
									  + "<button class='okButton shiny default important'>OK</button>",
					updateContents : function(message, okButtonTitle, cancelButtonTitle) {
						this.asPanel("updateContents");
						this.$body.html(message||"confirm ???!");
						this.$okButton.html(okButtonTitle||"OK");
						this.$cancelButton.html(cancelButtonTitle||"Cancel");
					}
				}).draw();
			}
			return UI.Confirm.showModal(message, okButtonTitle, cancelButtonTitle);
		},

		// Show a styled prompt(), which asks them to type in a value, with OK and Cancel buttons.
		// Returns a promise which will be resolve()d with the value if they press OK, or reject()ed if they Cancel.
		// @message is the message to show.
		// @defaultValue is the value to show in the prompt initially
		// @okButtonTitle is the title of the OK button.  (Default: "OK").
		// @cancelButtonTitle is the title of the cancel button.  (Default: "Cancel").
		prompt : function(message, defaultValue, okButtonTitle, cancelButtonTitle) {
			if (!UI.Prompt) {
				UI.Prompt = new Panel({
					mixins : "Modal",
					id : "Prompt",
					parts : {
						$message	: "## .message",
						$value		: "## .value",
					},
					bodyHTML : "<div class='message'></div>"
							 + "<input type='text' class='value'"
							 		+" onfocus='UI.onFieldFocused(event, $(this))'"
							 		+" onblur='UI.onFieldBlurred(event, $(this))' >",
					bottomToolbarHTML : "<button class='cancelButton shiny'>Cancel</button>"
									  + "<button class='okButton shiny default important'>OK</button>",

					// Override the RETURN keymap to accept when focused in the field.
					keyMap : [
						{ keys:"RETURN", whenFocused:true, enabled:"this.autoAccept", handler:"onOK", hint:"OK"},
					],
					// Return the value in the field.
					// NOTE: we automatically trim the value, eliminating any spaces!
					getSuccessValue : function() {
						return this.$value.val().trim();
					},
					updateContents : function(message, defaultValue, okButtonTitle, cancelButtonTitle) {
						this.asPanel("updateContents");
						this.$message.html(message||"prompt ???");
						this.$value.val(defaultValue||"");
						this.$okButton.html(okButtonTitle||"OK");
						this.$cancelButton.html(cancelButtonTitle||"Cancel");
					},

					// Focus in the field when we show the dialog.
					// NOTE: this doesn't work if you invoke `UI.prompt()` from the command line.
					onShown : function() {
						this.$value.select();
					}
				}).draw();
			}
			return UI.Prompt.showModal(message, defaultValue, okButtonTitle, cancelButtonTitle);
		},


		// Show a styled dialog which allows them to choose one of a list of items, with OK and Cancel buttons.
		// Returns a promise which will be resolve()d with the selected value if they press OK, or reject()ed if they Cancel.
		// @message is the message to show.
		// @list is either a simple array of strings or an object with {key:value} mapping.
		// @defaultValue is initial value to have selected (default is no selection).
		// @okButtonTitle is the title of the OK button.  (Default: "OK").
		// @cancelButtonTitle is the title of the cancel button.  (Default: "Cancel").
		choose : function(message, list, defaultValue, okButtonTitle, cancelButtonTitle) {
			if (!UI.Chooser) {
				UI.Chooser = new Panel({
					mixins : "Modal",
					id : "Chooser",
					parts : {
						$message	: "## .message",
						$value		: "## .value",
						$list		: "## .list",
						$items		: "LIVE:## .item"
					},
					events : [
						{selector:"## .item", event:"click", handler:"onItemClicked"}
					],
					bodyHTML : "<div class='message'></div>"
							 + "<div class='list'></div>",
					itemHTML : "<div class='item' key='{{key}}'>{{value}}</div>",
					bottomToolbarHTML : "<button class='cancelButton shiny'>Cancel</button>"
									  + "<button class='okButton shiny default important'>OK</button>",
					// Return the value in the field.
					// NOTE: we automatically trim the value, eliminating any spaces!
					getSuccessValue : function() {
						return this.selectedKey;
					},

					updateContents : function(message, list, defaultValue, okButtonTitle, cancelButtonTitle) {
						this.asPanel("updateContents");
						this.$message.html(message||"prompt ???");
						this.$value.val(defaultValue||"");
						this.$okButton.html(okButtonTitle||"OK");
						this.$cancelButton.html(cancelButtonTitle||"Cancel");
						var html = [];
						if (Array.isArray(list)) {
							list.forEach(function(value) {
								html.append(this.itemHTML.expand({key:value, value:value}));
							}, this);
						} else {
							for (var key in list) {
								var value = list[key];
								html.append(this.itemHTML.expand({key:key, value:value}));
							}
						}
						this.$list.html(html.join("\n"));

						// always scroll to top
						this.$list.scrollTop(0);
						delete this.selectedKey;

						// scroll to select the default value if possible
						if (defaultValue) {
							var $item = this.$list.find(".item[key='"+defaultValue+"']");
							if ($item.length) {
								$item.addClass("selected").scrollIntoView(null, null, "SKIP");
								this.selectedKey = defaultValue;
							}
						}

					},

					onItemClicked : function(event, $item) {
						var key = $item.attr("key");
						if (key == this.selectedKey) return this.onOK();
						this.selectedKey = key;
						this.$items.removeClass("selected");
						$item.addClass("selected");
					}
				}).draw();
			}
			return UI.Chooser.showModal(message, list, defaultValue, okButtonTitle, cancelButtonTitle);
		},


		// Show an alert() indicating that a feature isn't finished yet.
		notYet : function() {
			return UI.alert("Not yet implemented", "Oh well...");
		},


	});



	//
	//	global event handlers
	//

	// Set it up so we know when the DOM is ready
	$(document).ready(function() {
		UI.domReady = true;
	});

	// hide anything which has been set to hide on the next mouseUp event (See "hideOnClick" above)
	$("body").captureEvent("click", UI._onGlobalMouseUp);

	// set the UI up to receive hashchange events
	$(window).hashchange(UI.onHashChanged.bind(UI));

	// set the window up to resize the current page in a throttled fashion
	//	(eg: fires no more than once every 200 msec)
	$(window).resize(function(event) {
		// NOTE: jQuery UI sends resize events when page elements are resized!
		// 		 Only pay attention if the window started the event.
		if (event.target !== window) return;
		UI.soon("onWindowResized", 0.2);
	});

	return Singleton.UI;
});	// end define("oak/lib/ui/UI")
