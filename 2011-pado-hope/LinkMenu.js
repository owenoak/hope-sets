/* link which works like a select:
	click the link to see a menu of items, select an item to change the 'value'
*/

Script.require("{{hope}}Menu.js", function(){




new hope.Action.Subclass("hope.LinkMenu", {
	tag : "hope-linkmenu",
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
		},
		
		setOptions : function(options) {
console.warn(".setOptions not implemented");
		}
	}
});



Script.loaded("{{hope}}ListSelector.js");
});
