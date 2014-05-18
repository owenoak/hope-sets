/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Generic "Notable" mixin
//	Use this for a widget or other instance which wants to show notices to the user.
//	
//	If `UI && UI.Notice` is defined, we'll use that to display the message.
//	Otherwise we'll just log to console.
//
//	Call as:
//		`thing.showNotice(message)`					-- show a particular `message`
//		`thing.showNotice(message, true)`			-- show a particular `message`, blocking the UI while message is up. 
//		`thing.hideNotice()`						-- hide whatever `message` is currently showing
//		`thing.hideNotice(message)`	  				-- hide the notice if it is showing the `message`.
//		`thing.flashNotice(message)`				-- show a `message` for 1 second
//		`thing.flashNotice(message, delay)			-- show a `message` for `delay` milliseconds.
//

Module.define("oak/lib/ui/Notable", "oak/lib/core/Mixin", function(Mixin) {
	new Mixin("Notable", {
		// indicator that we are saveable
		isNotable : true,
	
		// Show a `message`.
		// You (or someone else) should balance this with a call to `hideNotice()`!
		// Pass `true` to `modal` to block the UI while the notice is being displayed.
		showNotice : function(message, modal) {
			if (window.UI && UI.showNotice) UI.showNotice(message, modal);
			else console.info(message);
		},

		// Show a `message` modally.
		showModalNotice : function(message) {
			this.showNotice(message, true);
		},

		// Hide the message being displayed.
		// If you pass a `message`, we'll only hide if that message is what's visible right now.
		hideNotice : function(message) {
			if (window.UI && UI.hideNotice) UI.hideNotice(message);
		},
		
		// Show a `message` for a little bit, then hide it.
		//	Default is to show for 1 second.  Pass a different `delay` in milliseconds to change this.
		flashNotice : function(message, delay) {
			if (window.UI && UI.flashNotice) UI.flashNotice(message, delay);
			else console.info(message);
		}
	
	
	});	// end new Mixin("Notable")
	return Mixin.Notable;
});	// end define("oak/lib/core/Mixin")
