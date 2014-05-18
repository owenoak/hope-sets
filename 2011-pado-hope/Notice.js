/*** 
		Notice:  Display a message, generally inside a control.
		
		Noticeable:  give your template a <... part='$notice'> element a
			and set  .notice = "xxx" to show a notice, or .notice = "" to hide it.
			Shows and hides your main container automatically as appropriate.
***/
Script.require("{{hope}}Element-attach.js", function(){


new Element.Subclass("hope.Notice", {
	tag : "hope-notice",
	properties : {
		template : "<hope-container/>",
		message : Attribute({	
			name : "message", 
			onChange : function(newMessage) {
				if (newMessage == null) {
					newMessage = "";
				} else if (typeof newMessage !== "string") {
					newMessage = ""+newMessage;
				}
				this.$container.html = newMessage;
				this.visible = (newMessage != "");
			}
		})
	}
});


// Noticeable mixin
new Mixin("Noticeable", {
	mixinTo : function(it) {
		this.as("Mixin", arguments);
		it.prototype.childProcessors = "hope-notice:initNotice";
		return it;
	},
	properties : {
		notice : new Attribute({name:"notice", 
					onChange : function(newMessage) {
						// if no notice element, call initNotice to add one
						if (!this.$notice) this.initNotice(new hope.Notice());

						if (typeof newMessage === "string") newMessage = newMessage.expand(this);
						this.$notice.message = newMessage;
						
						if (this.$notice.visible) 	this.fire("noticeShown");
						else						this.fire("noticeHidden");
					}
				}),

		initNotice : function(notice) {
			if (Element.debug) console.info(this, "processing notice", notice);
			this.$container.parentNode.insertBefore(notice, this.$container);
			this.classList.add("hasNotice");
			this.$notice = notice;
		},
		
		onNoticeShown : function() {
			if (this.$container) this.$container.visible = false;
//			if (this.$toolbar) this.$toolbar.visible = false;
//			if (this.$footer) this.$footer.visible = false;		
		},
		
		onNoticeHidden : function() {
			if (this.$container) this.$container.visible = true;
//			if (this.$toolbar) this.$toolbar.visible = true;
//			if (this.$footer) this.$footer.visible = true;
		}
	}
});

Script.loaded("{{hope}}Notice.js");
});// end Script.require
