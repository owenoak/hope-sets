/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/* 
	"Stack" of sub-items, one of which ("current") will be displayed at a time.
	Eg: a set of tabs, the UI which shows one page at a time.
	
 */


Module.define("oak/lib/ui/Stack",
"oak/lib/ui/Widget",
function(Widget) 
{

	return new Class("Stack", "Widget", {
		// map of items we manage, {widgetId => widget}
		items : undefined,

		// current widget we're displaying
		current : undefined,
	
		// Show one of our items, hiding the others.
		//	`it` is an item id or a pointer directly to on of our items.
		//	`args` is an optional array of arguments to pass to the 'show()' of the widget.
		showItem : function(it, args) {
			var item = this.getItem(it);
			if (!(item instanceof Widget) return console.warn(this,".showItem(",it,"): widget not found");
			if (this.current !== item) {
				this.hideCurrent();
			}
			this.current = item;
			this.current.show.apply(this.current, args||[]);
		},
	
		// Tell our current item to hide and reset our pointers.
		hideCurrent : function() {
			if (!this.current) return;
		
			if (this.current.hide) this.current.hide();
			this.current = undefined;
		},
	
		// Given an id or pointer to a widget in our items, return the widget.
		//	Returns undefined if no widget found, or not in our items.
		getItem : function(item) {
			if (typeof item === "string") return this.items[item];
			return item;
		},
	
	});	// end new Class("Stack")

});	// end define("oak/lib/ui/Stack")