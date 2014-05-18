/* Icons -- really just placeholders for images */

Script.require("{{hope}}Element-attach.js", function(){

new Element.Subclass("hope.Icon", {
	tag : "hope-icon",
	properties : {
		
		listeners : "click",

		icon : Attribute({name:"icon", update:true}),
		
		// action to do when clicked or our shortcut is pressed
		onActivate : new Attribute({name:"onactivate", type:"event", args:"event", inherit:true}),

		onClick : function(event) {
			if (this.enabled) this.fire("activate", event);
		}		
	}

});


Script.loaded("{{hope}}Icon.js");
});
