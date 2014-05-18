/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Panels are widgets with headers + body + footers.
//	`$header` contains a `$title` region and a `$topToolbar` region.
//	The `$body` region is where your content generally goes:
//		- by default, we assume you're setting an explicit size on the panel with CSS
//		- if you want to take up the entirety of your $root's parent, set `fullSize` to true.
//		- if you want it to size with its contents, set `scrollBody` to false
//	`$footer` contains a `$bottomToolbar` region.
//
//	NOTE: By default the header and footer are hidden.
//		 - Set `showingHeader=true` and `showingFooter=true` to show them, or
//		 - Set `title` or `topToolbarHTML` or `bottomToolbarHTML` to a non-empty value to show that.
//
//	Usable on its own, also used as a base class for other widget types (eg: CollectionViewer).
//


Module.define("oak/lib/ui/Panel",
"oak/lib/core/Class,oak/lib/core/Property,oak/lib/ui/Widget",
function(Class, Property, Widget) {
	new Class("Panel", "Widget", {

		// template to use as HTML for the panel by default
		widgetTemplate : "<div id='{{id}}' class='{{constructor.id}} {{className}} Panel'>"
							+ "<div class='Header'>"
								+ "<div class='Title'>{{title}}</div>"
								+ "<div class='TopToolbar Toolbar'>{{topToolbarHTML}}</div>"
							+ "</div>"
							+ "<div class='Body'>{{bodyHTML}}</div>"
							+ "<div class='Footer'>"
								+ "<div class='BottomToolbar Toolbar'>{{bottomToolbarHTML}}</div>"
							+ "</div>"
						+"</div>",


		parts : {
			$header			: "## > .Header",
			$title			: "## > .Header > .Title",
			$topToolbar		: "## > .Header > .TopToolbar",
			$body			: "## > .Body",
			$footer			: "## > .Footer",
			$bottomToolbar	: "## > .Footer > .BottomToolbar",
		},

		// When we're showing, set up our css classes according to the states below.
		updatePlugins : [function() {
			this._setClassesForCurrentState();
		}],

		// html to put insde the body when drawing initially (assuming you're using the default widget template).
		// NOTE: Only works to set this BEFORE you draw.
		bodyHTML : "",

		// html to put inside the top toolbar when drawing initially (assuming you're using the default widget template).
		// NOTE: Only works to set this BEFORE you draw.
		topToolbarHTML : Property.onChange(function(html){ if (html) this.showingHeader = true;	}),

		// html to put inside the bottom toolbar when drawing initially (assuming you're using the default widget template).
		// NOTE: Only works to set this BEFORE you draw.
		bottomToolbarHTML : Property.onChange(function(html){ if (html) this.showingFooter = true;	}),

		// Set CSS classes according to the state variables below
		_setClassesForCurrentState : function() {
			if (this.$root) {
				this.$root.toggleClass("fullSize", !!this.fullSize)
						  .toggleClass("scrollBody", !!this.scrollBody)
						  .toggleClass("showingHeader", !!this.showingHeader)
						  .toggleClass("showingFooter", !!this.showingFooter);
			}
		},

		// Set `fullSize=true` to take up all the space of your parent element.
		// NOTE: when you do this, you MUST set width/height of the entire panel,
		//		 or your element will be invisible because all its direct contents are position:absolute!
		fullSize : false,

		// Set `scrollBody=true` to make the body region scroll.
		// NOTE: when you do this, you MUST set `fullSize=true` or set width/height of the entire panel in CSSS,
		//		 or your element will be invisible because all its direct contents are position:absolute!
		scrollBody : false,

		// Set `showingHeader=true` to show the header region automatically.
		// NOTE: set to true automatically if you set `title` or `topToolbarHTML`.
		showingHeader : Property.onChange(function(){ this._setClassesForCurrentState(); }),

		// Set `showingFooter=true` to show the footer region automatically.
		// NOTE: set to true automatically if you set `bottomToolbarHTML`.
		showingFooter : Property.onChange(function(){ this._setClassesForCurrentState(); }),

		// Set `title=XXX` to show a title for the panel (also shows the header if necessary).
		title : Property.onChange(function(title)
					{
						if (title == null) title = "";
						if (this.$title) this.$title.html(title);
						// if we have a valid title and the header is not showing, show it
						if (title && !this.showingHeader) {
							this.showingHeader = true;
						}
						// if we have an empty title and the header is showing
						//	hide the header, but only if the top toolbar has no child elements.
						else if (!title && !this.showingHeader && this.$topToolbar.children().length === 0) {
							this.showingHeader = false;
						}
					}),


	});	// end new Class("Panel")

	return Class.Panel;
});	// end define("oak/lib/ui/Panel")
