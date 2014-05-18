/*** Control class: a widget class that has a "value" or a "binding" ***/
Script.require("{{hope}}Element-attach.js", function(){


// TODO: convert to hope.Mixin
new Mixin("Valued", {
	mixinTo : function(it, asClass) {
		if (it.isAClass || asClass) it = it.prototype;
		hope.extendIf(it, this.properties);
		it.attributeMap = "value:value";
		it.listeners = "shown";
		return it;
	},
	properties : {
		// a 'binding' is a simple property value you can us to dynamically retrieve
		//	the value of this object. eg:  hope.get(binding)  will return the current value.
		binding : Attribute("binding"),
		
		// HMMM, why is this not an attribute ?
		value : Property({
			get : function() {
				var binding = this.binding;
				if (binding) return hope.get(binding);
				if (this.getInputValue) return this.getInputValue();
				return this._value;
			},
			
			set : function(newValue) {
				if (this._updateValue(newValue) == false) return;
				this.soon("update");
			}
		}),
		
		// update our bound value without updating the display
		//	returns true if value was actually changed, false if no change
		_updateValue : function(newValue) {
			var oldValue = this.value;
			if (oldValue === newValue) return false;

//TODO: this is wacky, simplify or at least clarify

			var binding = this.binding;
			if (binding) {
				hope.set(binding, newValue);
			} else if (this.updateInputValue) {
				this.updateInputValue(newValue);
			} else {
				this._value = newValue;
			}
			this.bubble("valueChanged", newValue, oldValue, this);
			return true;
		},
	
		onShown : function() {
			this.soon("update");
		}
	}
});

Script.loaded("{{hope}}Valued.js");
});// end Script.require
