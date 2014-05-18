/* iOS list selector (kinda). */

//TODO: make items from a static list (semantics?)

Script.require("{{hope}}Menu.js", function(){


new hope.Menu.Subclass("hope.PopoverMenu", {
	tag : "hope-popovermenu",
	mixins : "Valued",
	properties : {
		template : "<hope-container appearance='white'/><span class='arrow' />",
		
		onReady : function() {
			this.onChild("row", "click", "onRowClicked");
		},
		
		onUpdate : function() {
			var old = this.getChild("row[selected]"),
				selected = this._selectedItem()
			;
			if (old && old != selected) {
				old.selected = false;
			}
			if (selected) {
				selected.selected = true;
			}
			
			// if we have a 'context', that will be our menu button
			//	tell it to update
			if (this.context) this.context.value = this.value;
		},
		
		onRowClicked : function(event, row) {
			var value = row.attr("value");
			if (value != this.value) {
				this.value = value;
				this.fire("changed", value);
			}
			this.fire("update");
			if (this.autoHide) this.visible = false;
		},
		
		
		_selectedItem : function() {
			return this.getChild("row[value='"+this.value+"']")
		},
		
		selectedLabel : function() {
			var item = this._selectedItem();
			if (item) {
				item = item.getChild("label");
				if (item) return item.innerHTML;
			}
			return this.value;
		}
	}
});


new hope.Action.Subclass("hope.PopoverMenuButton", {
	tag : "hope-PopoverMenuButton",
	mixins : "Valued",
	properties : {
		listeners : "click",
		
		onReady : function() {
			// hook us up to be notified when our menu changes
			setTimeout(this.attachToMenu.bind(this), 10);
		},
		
		menu : Attribute("menu"),
		$menu : Getter(function(){ return select(this.menu); }),
		attachToMenu : function() {
			var menu = this.$menu;
			if (menu) menu.on("update", this.onUpdate, this);
		},
		
		onClick : function(event) {
			var menu = this.$menu;
			if (menu) menu.showForElement(this, event);
		},
		
		onUpdate : function() {
			var menu = this.$menu, value;
			if (menu) value = menu.selectedLabel();
			this.html = value || this.value;
		}
	}
});




Script.loaded("{{hope}}ListSelector.js");
});
