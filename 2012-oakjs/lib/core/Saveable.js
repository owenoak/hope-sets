/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Generic "Saveable" mixin
//

Module.define("oak/lib/core/Saveable",
"oak/lib/core/Mixin,oak/lib/core/Property",
function(Mixin, Property) {
	new Mixin("Saveable", {
		// Indicator that we are saveable.
		isSaveable : true,

		// Do we need to save?
		isDirty : false,

		// Are we currently saving?
		isSaving : false,

		// Are we currently read-only?
		// Set this to `true` to disable saving functionality, including autoSave.
// NOTE: this does NOT disable "saveThing()" functionality, should it???
		isReadOnly : false,

		// should we auto-save when the saveable is dirty?
		autoSave : false,

		// delay in seconds between when we're marked as dirty and when we should auto-save
		autoSaveDelay : 0,

		// modal message to show while saving
		saveMessage : null,

		// If set to a jquery object, we'll assume it's a button-ey thing that can be pressed to save us.
		// When `dirty()` is called, we'll add a "dirty" class to this object when dirty.
		$saveButton : undefined,

		// jQuery Deferred object which will save the resource.
		//	NOTE: if this is set, we're currently saving.
		saver	 : undefined,

		// Mark this item as dirty and (if autoSave == true) save us automatically in a little while.
		dirty : function(newState) {
			if (this.isReadOnly) return;

			if (newState == null) 	newState = true;
			else					newState = !!newState;
			if (newState != this.dirty) {
				this.isDirty = newState;
				if (this.isDirty) 	$(this).trigger("changed");
				else				$(this).trigger("reset");
			}

			if (this.$saveButton) this.$saveButton.toggleClass("dirty", newState);

			// if autoSaveDelay is positive, save us "soon"
			if (this.isDirty && this.autoSave) this.soon("save", this.autoSaveDelay);
		},

		// Save me now!
		//	Returns a promise so you can do something when the callback completes.
		//	If not dirty, will not save but (returns an immediately resolved promise).
		//	Use `forceSave()` to save whether we're dirty or not.
		//
		//	You can pass an "initialParams" object which will be used in `getSaver()`,
		//		eg:   pass   `{data:"SOME DATA TO SAVE"}` to force some particular file contents
		//			  rather than what would normally be saved (via `getDataToSave()`).
		//
		// TODO: some inflection points before/after the save?
		//
		save : function(initialParams) {
			// clear the 'soon' callback in case save was executed manually
			this.clearSoon("save");

			// If we're read-only, return an immediately resolved promise.
			if (this.isReadOnly) return $.when();

			// if already saved, call the callback immediately
			if (!this.isDirty) {
				return $.when(this).done();
			}

			// if we're currently saving
			else if (this.saver) {
				// nothing to do, caller can attach .done() and .fail() callbacks as it likes
			}

			// dirty and/OR we want to forceSave:
			//	-- start saving now!
			else {
				this.saver = this.getSaver(initialParams);
				this.isSaving = true;

				// modal message to show while saving
				var saveMessage = this.saveMessage;
				if (saveMessage) UI.showModalNotice(saveMessage);

				function onDone() {
					if (this.savedMessage) 	UI.flashNotice(this.savedMessage);
					else if (saveMessage)  	UI.hideNotice(saveMessage);

					this.isSaving = false;
					delete this.saver;
					this.onSaved.apply(this, arguments);
					this.dirty(false);
					$(this).trigger("saved");
				}

				function onError() {
					if (this.saveErrorMessage)	UI.flashNotice(this.saveErrorMessage);
					else if (saveMessage)  		UI.hideNotice(saveMessage);

					// TODO: more details on saveError for diagnostics?
					this.isSaving = false;
					this.saveError = true;
					delete this.saver;
					this.onSaveError.apply(this, arguments);
					$(this).trigger("saveError");
				}

				// add the handlers
				this.saver.done(onDone.bind(this));
				this.saver.fail(onError.bind(this));
			}

			return this.saver;
		},

		// Force a save, whether we're dirty or not.
		forceSave : function(initialParams) {
			this.isDirty = true;
			return this.save(initialParams);
		},

		// Cancel any pending save (eg: when autoSave is on).
		cancelPendingSave : function() {
			this.isDirty = false;
			this.clearSoon("save");
		},

		// Return the url to use to save this resource.
		getUrlToSave : function() {
			throw this+".getUrlToSave(): you must override this function!";
		},

		// Return a map of data to be sent as the POST body of the save request.
		//	YOU PROBABLY WANT TO OVERRIDE THIS
		getDataToSave : function() {
			return null;
		},

		// Return a jQuery Promise which will save the resource.
		//	Generally, this just uses this.getUrlToSave() to figure out where to save from,
		//	so you won't often have to override this.
		getSaver : function(initialParams) {
			var params = {};
			if (initialParams) Property.extend(params, initialParams);

			if (!params.type) 	params.type = "POST";
			if (!params.url) 	params.url = this.getUrlToSave();
			if (!params.data)	{
				var data = this.getDataToSave();
				if (data) params.data = data;
			}
			if (params.url) params.url = Module.expandUrl(params.url, this);
			return $.ajax(params);
		},

		// You have finished saving!  Do something.
		//	$root is a jQuery vector of the XML which was saved
		//	YOU PROBABLY WANT TO OVERRIDE THIS
		onSaved : function($root) {},

		// There was an error saving your stuff.
		//	YOU PROBABLY WANT TO OVERRIDE THIS
		onSaveError : function() {},


	});	// end new Mixin("Saveable")
	return Mixin.Saveable;
});	// end define("oak/lib/core/Mixin")
