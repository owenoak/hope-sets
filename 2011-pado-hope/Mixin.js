/* 	Mixin constructor.  

	You don't have to use this, your mixin just needs to define a "mixinTo" method.
	This is mainly here for clearer semantics to create mixins.

	eg:
		new Mixin("Valued", {
			// OPTIONAL: method to mix into source thing, a good default will be provided.
			//				Override to do something exotic.
			mixinTo : function(it) { ... },
			
			// OPTIONAL: properties to use to extend the instance prototype
			properties : {...},
			
			// OPTIONAL: properties to use to extend the constructor
			"static" : {...}
		});
	
*/

Script.require("{{hope}}Class.js", function() {
	
	function Mixin(id, mixinProps) {
		// call as Mixin(...) or new Mixin(...), same thing
		if (this == window) return new Mixin(id, mixinProps);
		
		if (!mixinProps) mixinProps = {};
		hope.extend(this, mixinProps);
		
		// define the mixin globally
		this.id = id;
		hope.setGlobal(id, this);
		
		return this;
	}
	
	Mixin.prototype = {
		isAMixin : true,
		
		// default mixinTo 
		mixinTo : function mixinTo(it, asClass) {
			var statics = this['static'],
				properties = this.properties
			;
			// if we're mixing into a class, 
			//		mix the static stuff into the class an properties into the prototype
			if (asClass || it.isAClass) {
				if (statics)  	hope.extendIf(it, statics);
				if (properties) hope.extendIf(it.prototype, properties);
			} 
			// otherwise mix both static and properties into the object itself
			else {
				if (statics)  	hope.extendIf(it, statics);
				if (properties) hope.extendIf(it, properties);
			}
			return it;
		},

		applyTo : function(it) {
			this.mixinTo(it);
		},
		
		as : Observable.prototype.as,
		
		toString : function() {
			return "[Mixin "+this.id+"]";
		}
	}
	
	
	// TODO: hope.Mixin ?
	hope.setGlobal("Mixin", Mixin);

	Script.loaded("{{hope}}Mixin.js");
});
