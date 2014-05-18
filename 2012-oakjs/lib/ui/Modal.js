/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//!///////////////
//
//	Make any widget modal by mixing this into the instance or Class.
//'		var it = new Widget({  mixins:"Modal", ... })
//	Show the widget modally via:
//'		it.showModal(...args to pass to show...)
//'			.done(function(value) {...something to do with the "success value"... })
//'			.fail(function() { ...something to do if they 'cancelled' the dialog })
//
//	Implement `getSuccessValue()` to return the value which should apply when the widget is accepted.
//
// TODOC
//!///////////////
Module.define("oak/lib/ui/Modal",
"oak/lib/core/Mixin",
function(Mixin) {

	// stack of currently open modals
	// TODO: put this on UI or on Modal or something!
	window.ModalStack = [];

	return new Mixin("Modal", {

		// True if we should allow return key to accept the dialog (press "OK").
		// You can override with a property if you want dynamic behavior.
		autoAccept : Property.Getter(function() {
			return this.$okButton && this.$okButton.length > 0;
		}),

		// True if we should allow return key to cancel the dialog (press "Cancel").
		autoCancel : true,


		parts : {
			$closebox 		: "## > .Closebox",		// an element with class `Closebox` will act as a "Close" button.
			$okButton 		: "## .okButton",		// an element with class `okButton` will act as an "OK" button.
			$cancelButton	: "## .cancelButton"	// an element with class `cancelButton` will act as a "Cancel" button.
		},

		events : [
			// click on the closebox should hide us.
			{selector:"$closebox", event:"click", handler:"onCloseBoxClick"},

			// ok button should accept us.
			{ selector:"$okButton", event:"click", handler:"onOK" },

			// cancel button should cancel us.
			{ selector:"$cancelButton", event:"click", handler:"onCancel" },
		],

		keyMap : [
			{ keys: "ESCAPE", whenFocused:true, enabled:"this.autoCancel", handler:"onCancel", hint:"Cancel"},
			{ keys: "RETURN", enabled:"this.autoAccept", handler:"onOK", hint:"OK"},
			{ keys: "NUM-ENTER", enabled:"this.autoAccept", handler:"onOK", hint:" "},
		],

		// Set `showClickMask` to true to show a clickMask behind us whenever we show.
		// NOTE: you must set this BEFORE you call `showModal()`!
		// See `UI.onClickMaskClick()`.
		showClickMask : true,

		// Set `showingClosebox` to true to show/enable a "closer".
		// NOTE: you must set this BEFORE you call `show()` or `showModal()`!
		showingClosebox : false,
		CLOSEBOX_TEMPLATE : "<div class='Closebox'></div>",

		// Show as a modal widget.  All arguments will be passed to `widget.show()`
		// NOTE: We return a different promise than the normal one from `widget.show()`,
		//		 this will only be returned once the `onOK()` or `onCancel()` is called,
		//		 thus the `showModal()` promise will be invoked when the dialog is closed.
		showModal : function() {
			var args = Function.args();

			// create a new promise to be resolved when the dialog is closed.
			if (this.modalPromise) this.modalPromise.rejectWith(this);
			this.modalPromise = new $.Deferred();

			this.showingModally = true;

			// make sure we're loaded
			this.load().done(function() {
				// append us to the body
				$("body").append(this.$root);
				// and bring us to the front of everything else
				this.$root.bringToFront();

				// delgate down to show() to actually display
				this.show.apply(this, args);
			}.bind(this));

			return this.modalPromise;
		},



		// Return the success value for this dialog IN ITS CURRENT STATE.
		// NOTE: you should override this to return the 'value' of your dialog.
		getSuccessValue : function() {
			return undefined;
		},

		// Set CSS classes for our modal state.
		_setClassesForCurrentState : function() {
			this.asPanel("_setClassesForCurrentState");
			if (this.$root) {
				this.$root.toggleClass("showingModally", this.showingModally)
						  .toggleClass("showingClosebox", this.showingClosebox);
			}
		},

		onShowingPlugins : [function() {
			if (this.showingClosebox && this.$closebox.length === 0) {
				this.$closebox = $(this.CLOSEBOX_TEMPLATE);
				this.$root.append(this.$closebox);
			}

			if (this.showingModally) UI.showClickMask(this);
			this.$root.bringToFront();

			// add us to the stack of modal things
			ModalStack.append(this);
		}],

		// make sure we kill our modalPromse after we've been hidden
		onHiddenPlugins : [function() {
			delete this.modalPromise;

			// remove us from the stack of modal things
			ModalStack.remove(this);
			if (ModalStack.length === 0) {
				UI.hideClickMask();
			} else {
				var previousModal = ModalStack.last();
				UI.clickMaskTarget = previousModal;
				previousModal.$root.bringToFront();
			}
			this.showingModally = false;
		}],

		// OK button pressed.
		// Attempt to call `getSuccessValue()` on the widget and return that as the resolution of our modalPromise.
		//	If `getSuccessValue()` throws, we will NOT dismiss the dialog.
		onOK : function() {
			var successValue;
			try {
				successValue = this.getSuccessValue();
			} catch (exception) {
				console.warn(exception);
				return;
			}
			// actually resolve the promise on a timeout, so hide() will complete.
			var promise = this.modalPromise;
			if (promise) {
				setTimeout(function() {
					promise.resolveWith(this, [successValue]);
				}.bind(this), 10);
			}
			if (this.isShowing) this.hide();
		},

		// Cancel button pressed.
		//	Note: clicking outside the dialog does a 'cancel'.
		onCancel : function(event) {
			// actually reject the promise on a timeout, so hide() will complete.
			var promise = this.modalPromise;
			if (promise) {
				setTimeout(function() {
					promise.rejectWith(this);
				}.bind(this), 10);
			}
			if (this.isShowing) this.hide();
			if (event && event.preventDefault) event.preventDefault();
		},

		// Click on the click mask behind the UI -- calls our `onCancel()` routine.
		onMaskClick	: function(event) {
			this.onCancel(event);
		},

		// Click on our closebox -- calls our `onCancel()` routine.
		onCloseBoxClick : function(event) {
			this.onCancel(event);
		},


	});	// end new Class("Modal")
});	// end define("oak/lib/ui/Modal")
