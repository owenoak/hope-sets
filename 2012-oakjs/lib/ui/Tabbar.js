/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/* Tab bar widget */


Module.define("oak/lib/ui/Tabbar", 
"oak/lib/core/Class,oak/lib/ui/Widget", 
function(Class, Widget) {
	return new Class("Tabbar", "Widget", {
		// default selector for each tab button
		itemSelector 		: ".Tab",
		
		// attribute in the tab button which gives us this tab's "name"
		tabNameAttribute 	: "tab",
		
		// If true, we remember the last tab selected and restore next time
		rememberSelected : true,
		
		// NAME of the selected tab
		selected : null,
		
		// NAME of the default selected tab.
		//	If null, the first tab will be used.
		defaultTab : null,
		
		parts : {
			$bar	: "## > .Tabbar",
			$body	: "## > .Body",
			$tabs	: "## .Tab",
		},
		
		events : [
			// anything with a "menuItem" class will automatically hide the menu selected
			{ selector:"$tabs", event:"click", handler:"onTabClicked" },
		],
		
		onReady : function() {
			if (this.rememberSelected) {
				var selected = this.preference("selected");
				if (!selected) {
					if (this.defaultTab) 	selected = this.defaultTab;
					else					selected = this.getTabName($(this.$tabs[0]));
				}
				this.soon("selectTab", [selected]);
			}
		},
		

		selectTab : function(tabName) {
console.debug(this, ".selectTab(",tabName,")");

			// remember selection
			this.selected = tabName;
			
			// update tab selection state
			this.$tabs.removeClass("selected");
			this.get$tab(tabName).addClass("selected");
			
			// remember what was selected
			if (this.rememberSelected) this.preference("selected", tabName);
		
			// call onTabSelected to allow observers/instances to do some real work
			this.onTabSelected(tabName);
		},
		

		// event fired when a tab is selected
		onTabSelected : function(tabName) {
			$(this).trigger("tabSelected", tabName);
		},

		// When mouse goes up in any menu item, hide the menu by default
		onTabClicked : function(event, $item) {
			var tabName = this.getTabName($item);
			if (tabName) this.selectTab(tabName);
		},
	
		// Return the name of a tab, as recorded in the tab element.
		getTabName : function($element) {
			return $element.attr(this.tabNameAttribute);
		},
		
		// Return a $tab given a tabName
		get$tab : function(tabName) {
			var i = -1, tab;
			while (tab = this.$tabs[++i]) {
				if ($(tab).attr(this.tabNameAttribute) === tabName) return $(tab);
			}
		}
	
	});	// end new Class("Tabbar")
});	// end define("oak/lib/ui/Tabbar")

