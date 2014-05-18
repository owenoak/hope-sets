/* Output -- label that shows a value. */

Script.require("{{hope}}Element-attach.js", function(){


// GRRRR... you can't take over an  <output>'s @value attribute in WebKit
new Element.Subclass("hope.Output", {
	tag : "hope-output",
	mixins : "Valued",
	properties : {
		onUpdate : function() {
			var value = this.value;
			if (value == null) value = "";
			this.html = value;
		}
	}
});

new Element.Subclass("hope.Value", {
	tag : "hope-value",
	mixins : "Valued",
	properties : {
		onUpdate : function() {
			var value = this.value;
			if (value == null) value = "";
			this.html = value;
		}
	}
});




Script.loaded("{{hope}}Output.js");
});
