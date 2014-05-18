/* Panel -- just a container for things. */

Script.require("{{hope}}Element-attach.js", function(){


new Element.Subclass("hope.Panel", {
	tag : "hope-panel",
	properties : {
		// when we're shown, update the enabled on all items with an enableIf
		//	NOTE: if you set enableIf in JS for something, this won't catch it!
		onShown : function() {
			this.getChildren("*[enableif]").property("enabled");
		}
	}
});



Script.loaded("{{hope}}Panel.js");
});
