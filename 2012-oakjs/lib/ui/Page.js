/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/* Pages are top-level loadable content regions in our ajax app.

	MANDATORY: 	in order to work properly with the UI.setPage() methodology
		- your page MUST have an id
		- there must be exactly one element on the page with that id

	OPTIONAL:	you can take advantage of any of the following behaviors if you want
		- by default, when your page is shown/hidden:
			- ALL items on the page with attributes
					page='MyPage'
				will automatically be shown/hidden as well (with no visual effect).
			- page._setUpEvents() and page._tearDownEvents() will be called
		- page.updateContents() will be called when the window is resized while page is visible

	PATTERNS: 	you might want to use:
		- use page.events to create a map of events which will automatically be
			hooked up when the page is shown and unhooked when page is hidden


*/

Module.define("oak/lib/ui/Page",
"oak/lib/ui/Widget",
function(Widget) {
	new Class("Page", Widget, {

		isShowing:false,

		parts : {
			// by default, the "body" of a page is it's main element
			// override in your widget by defining a $body part
			$body : "##",

			// by default, when we do a page.showNotice() it takes over the main element
			// override in your widget by defining a $notice part
			$notice : "##",

			// We can have multiple toolbar elements.
			$toolbars : "##PageToolbar,##SocialToolbar",

			// page toolbar element, will be automatically installed and shown in
			//	the #PageToolbarContainer when this page is shown or hidden
			$pageToolbar : "##PageToolbar",

			// social toolbar element, will be automatically installed and shown in
			//	the #SocialToolbarContainer when this page is shown or hidden
			$socialToolbar : "##SocialToolbar"

		},

	//
	//	display / layout
	//

		onReady : function() {
			// place our $pageToolbar into the PageToolbarContainer
			var $container = $("#PageToolbarContainer");
			if (this.$pageToolbar) {
				this.$pageToolbar.hide();
				$container.append(this.$pageToolbar);
			}

			// place our $socialToolbar into the SocialToolbarContainer
			var $container = $("#SocialToolbarContainer");
			if (this.$socialToolbar) {
				this.$socialToolbar.hide();
				$container.append(this.$socialToolbar);
			}
		},

		// we're about to be shown
		onShowingPlugins : [function() {
			// clear stuff from the previously-displayed page
			var oldPage = UI.page;

			// reset to the new page
			$(UI).trigger("pageChanged", [this, oldPage]);

			// if we were showing someone else, hide it
			if (oldPage && oldPage !== this && oldPage.isLoaded) {
				oldPage.hide()
			}

			// show things to be shown for the page
			$("*[page~='"+this.id+"']").each(function() {
				$(this).show();
			});

			// select any 'pagetabs' associated with this page
			$(".pagetab[forpage='"+this.id+"']").each(function() {
				$(this).addClass("selected");
			});

			// show our toolbars
			this.$toolbars.show();
		}],

		// After the page has been shown, update hash, window title and breadcrumbs
		onShownPlugins : [function() {
			this.updateBrowserState();
		}],

		onHidingPlugins : [function() {
			// hide elements which were associated with this page
			//	but ONLY if they're not also associated with the UI's current page
			var currentId = (UI.page ? UI.page.id : null);
			$("*[page~='"+this.id+"']").each(function() {
				var $page = $(this);
				var sections = $page.attr("page").split(" ");
				if (!sections.contains(currentId)) $page.hide();
			});

			// deselect any 'pagetabs' associated with this page
			$(".pagetab[forpage='"+this.id+"']").each(function() {
				$(this).removeClass("selected");
			});

			// hide our toolbars
			this.$toolbars.hide();
		}],

		// we've just finished hiding our main element
//		onHidden : function() {},


		initPromos : function() {},

	//
	//	page semantics:  hash, breadcrumbs, window title
	//

		// set them statically if they don't change...
		section		: null,
		pageTitle	: null,
		windowTitle	: null,
		hash 		: null,
		breadcrumbs : null,
		replaceHash	: false,

		// ... or override the 'getX' routines below

		getPageTitle : function() {
			if (this.pageTitle) return this.pageTitle;
			console.warn(this+".getPageTitle():  Set page.pageTitle or override .getPageTitle()");
			return "";
		},

		getWindowTitle : function() {
			if (this.windowTitle) return this.windowTitle;
			var pageTitle = this.getPageTitle();
			if (pageTitle != null) return pageTitle;
			console.warn(this+".getWindowTitle():  Set page.windowTitle or override .getWindowTitle()");
			return "";
		},

		getHash : function() {
			if (this.hash) {
				var hash = this.hash.split(",")[0];
				return hash;
			}
			console.warn(this+".getHash():  Set hash or override .getHash()");
		},

		getBreadcrumbs : function() {
			if (this.breadcrumbs) return this.breadcrumbs;
			var crumbs = [];
			crumbs.append(["LOGO-BUG-TITLE", "MENU:PageMenu"])
			var title = this.getWindowTitle() || "";
			if (title.join) title = title.join(" ");
			crumbs.append([title]);
			return crumbs;
		},


		// internal routines -- you probably don't need to change these

		updateBrowserState : function() {
			this.updatePageTitle();
			this.updateWindowTitle();
			this.updateBreadcrumbs();
			var hash = this.updateHash();
			if (hash && this.isLibraryPage) UI.setLibraryHash(hash);
		},

		updateWindowTitle : function() {
			var title = this.getWindowTitle();
			if (typeof title === "string") 	return UI.setWindowTitle(title);
			else		console.warn(this+".updateWindowTitle():  Set title or override .updateWindowTitle()");
			return title;
		},

		updateHash : function() {
			var hash = this.getHash();
			if (hash) 	UI.setHash(hash, this, this.replaceHash);
			else		console.warn(this+".updateHash():  Set hash or override .updateHash()");
			return hash;
		},

		updateBreadcrumbs : function() {
			var crumbs = this.getBreadcrumbs();
			if (crumbs) UI.setBreadcrumbs(crumbs);
			return crumbs;
		},



	//
	//	showing a "notice" in place of our normal body contents
	//

		getNoticeHTML : function(message) {
			return "<div class='Notice'>"+message+"</div>";
		},

		showNotice : function(message) {
			var html = this.getNoticeHTML(message);
			this.$notice.html(html);
		},

		clearNotice : function() {
			this.$notice.html("");
		},


	//
	//	Debug
	//
		toString : Widget.prototype.toString

	});	// end new Class("Page")

	return Class.Page;
});	// end define("oak/lib/ui/Page")
