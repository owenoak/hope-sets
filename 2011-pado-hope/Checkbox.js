/* Checkbox: checkbox w/associated label
*/

Script.require("{{hope}}Element-attach.js", function(){


//TODO: is this
new Element.Subclass("hope.Checkbox", {
	tag : "hope-checkbox",
	mixins : "Valued",
	properties : {
		// set things up and do the initial update when ready
		onReady : function() {
			this.initializeInput();
			this.fire("update");
		},
		
		// template is our message display -- the input is created in initializeInput
		template : "<hope-group>\
						<input part='hope-checkbox:$input' type='checkbox'>\
						<label part='hope-checkbox:$label'></label>\
					</hope-group>\
					<hope-message part='$message' visible='no'/>",

		// value map for when checkbox is checked or unchecked
		checkedValue : Attribute({name:"checkedValue", inherit:true, value:"yes" }),
		uncheckedValue : Attribute({name:"uncheckedValue", inherit:true, value:"no" }),


		// label to show next to the checkbox (to the right by default)
		label : Attribute({name:"label", update:true, 
					onChange:function(newValue) {
						if (this.$label) this.$label.html = newValue;
					}
				}),


		// hint to show below the field
		hint : Attribute({name:"hint", update:true, 
					onChange:function(newValue) {
						this.updateMessage();
					}
				}),
		
		// (single) error message to display below the field
		// To show an error for the field, set field.error = "blahblah";
		// To clear the error for the field, set field.error = "";
		error : Attribute({name:"error", update:true, 
					onChange:function(newValue) {
						this.updateMessage();
					}
				}),
		
		
		// template for rendering our actual input control
//TODO: what about some non-standard input, like a slider we create ourselves, etc???
		checkboxTemplate : "",

		// update input + message field on update
		onUpdate : function() {
			if (!this.isReady) return;
//console.info("onUpdate() for ",this, this.value);
			this.updateInputValue();		
			this.updateMessage();
		},

		// actually change the value of our input field to match our bound value
		updateInputValue : function(value) {
			if (!this.$input) return;
			if (arguments.length == 0) value = this.value;
			this.$input.checked = (value == true || value == this.checkedValue);
		},
		
		// return the value actually stored in the input right now
		getInputValue : function() {
			if (!this.$input) return;
			return (this.$input.checked ? this.checkedValue : this.uncheckedValue);
		},
		
		// Attach our parts, setting up all events as necessary.
		// Called automatically by .onReady()
		initializeInput : function() {
			if (!this.isReady) return;

			this.$input.on({
				scope : this,
				change : "onInputChangedEvent",
// ???
//				focus : "onInputFocusEvent",
//				blur : "onInputBlurEvent"
			});

			this.$input.enabled = this.enabled;

			this.$label.html = this.label;
			this.$label.on({
				scope : this,
				click : "onLabelClicked"
			});
			this.updateInputValue();
		},
		
		// enable/disable our input as our enabled changes
		onEnabled : function() {
			if (this.$input) this.$input.enabled = true;
		},
		
		onDisabled : function() {
			if (this.$input) this.$input.enabled = false;		
		},


	//
	//	handle events sent from the input -- translates them into our events
	//
		
		onInputChangedEvent : function(event) {
			this.soon("inputChanged");
			return true;
		},

		onLabelClicked : function() {
			if (!this.enabled) return;
			this.$input.checked = !this.$input.checked;
			this.onInputChanged();
		},
		
		// fired when the input value changes
		onInputChanged : function(event) {
console.warn("onInputChanged",this, this.getInputValue());
			this._updateValue(this.getInputValue());
		},
		
		
	//
	//	message stuff, including icon management
	//
		
		updateMessage : function() {
			if (!this.$message) return;
			if (this.error) {
				this.classList.add("error");
				this.$message.className = "error";
				this.$message.html = this.error;
				this.$message.visible = true;
			} else if (this.hint) {
				this.classList.remove("error");
				this.$message.className = "hint";
				this.$message.html = this.hint;
				this.$message.visible = true;
			} else {
				this.$message.visible = false;
				this.$message.html = "";
			}
		},

	}
});



Script.loaded("{{hope}}Textfield.js");
});
