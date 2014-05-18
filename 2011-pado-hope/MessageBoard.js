/*** 
		MessageBoard:  Display a set of messages in the upper-left corner of the screen.
						Notices decay after a while and disappear.

					  This is a singleton.
***/
Script.require("{{hope}}Element-attach.js", function(){


new Element.Subclass("hope.MessageBoard", {
	tag : "hope-messageboard",
	properties : {
		onReady : function() {
			// start the timer which decays messages every second
			this.$interval = setInterval(this.decayMessages.bind(this), 1000);
			this.onChild("hope-message", "click", "onMessageClick");
		},
				
		// decay time in SECONDS
		decay : Attribute({name:"decay", type:"number", inherit:true, value:3}),
	
		showMessage : function(message) {
			this._addToBoard("message", message);
		},
		
		showWarning : function(message) {
			this._addToBoard("warning", message);
		},
		
		showError : function(message) {
			this._addToBoard("error", message);
		},
		
		messageTemplate : "<hope-message class='{{className}}' timestamp='{{timestamp}}'>{{message}}</hope-message>",
		
		_addToBoard : function(className, message) {
			var $message = this.messageTemplate.inflateFirst({
				className:className, 
				message:message,
				timestamp : Date.now()
			});
			this.append($message);
		},
		
		decayMessages : function() {
			var decayIfBefore = (Date.now() - this.decay * 1000);
			var messages = this.getChildren("hope-message"),
				stillShowing = 0
			;
			messages.forEach(function(message) {
				if (message.attr("done")) return;
				var showTime = parseInt(message.attr("timestamp"));
				if (showTime < decayIfBefore) {
					message.attr("done", "yes");
					message.opacity = 0;
				}
				stillShowing++;
			});
			// if we're hiding all of the current messages, clear 'em
			if (stillShowing == 0) {
				messages.forEach(function(message) {
					message.remove();
				});
			}
		},
		
		onMessageClick : function(event, message) {
			message.attr("done","yes");
			message.opacity = 0;
			console.warn(event, message);
		}
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
