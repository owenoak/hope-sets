/* Overlays, like a dialog, but doesn't necessarily have a close button */

Script.require("{{hope}}Element-attach.js", function(){

new hope.Section.Subclass("hope.Overlay", {
	tag : "hope-overlay",
				
	properties : {
		visible : false,
		template : "<hope-mask part='hope-overlay:$mask'>\
						<hope-border part='hope-overlay:$border'>\
							<hope-close part='hope-overlay:$close' visible='no'/>\
							<hope-container/>\
						</hope-border>\
					</hope-mask>",
		autoHide : new Attribute({name:"autoHide", type:"flag", falseIf:[false,"false","no"] }),
		listeners : "click:onClick",
		
		onShown : function() {
			this.$close.visible = this.autoHide;
		},
		
		onClick : function(event) {
			if (!this.autoHide) return;
			if (event.target === this.$close ||
				 (event.target == this.$mask && this.autoHide)) this.visible = false;
		}
	}
});


// create an overlay w/id "loadingMessage" to show/hide messages when loading
new hope.Overlay.Subclass("hope.LoadingMessage", {
	tag : "hope-overlay",
	selector : "#loadingMessage",
	properties : {
		template : "<hope-mask part='hope-overlay:$mask'>\
						<hope-border part='hope-overlay:$border'>\
							<hope-close part='hope-overlay:$close' visible='no'/>\
							<hope-container><hope-notice part='hope-overlay:$notice'/></hope-container>\
						</hope-border>\
					</hope-mask>",

		showMessage : function(message) {
			this.$notice.html = message;
			this.visible = true;
		}
	}
});

Script.loaded("{{hope}}Overlay.js");
});
