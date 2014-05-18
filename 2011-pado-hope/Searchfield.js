/* Webkit-style search input.  Tested only in Safari/Chome. 

	Observe "searchChanged" to be notified when the search value has changed.
	
*/


Script.require("{{hope}}Element-attach.js", function(){


//TODO: is this
new hope.Textfield.Subclass("hope.Searchfield", {
	tag : "hope-searchfield",
	properties : {
		// monitor events so we can call inputChanged
		onReady : function() {
			this.as(hope.Textfield);
			this.on({
				scope : this,
				keydown : "onDelaySearchChanged",
				search : "onImmediateSearchChanged",
				change : "onImmediateSearchChanged"
			});
		},

		keypressDelay : Attribute({name:"keypressDelay", type:"number", update:true, 
									inherit:true, value:500}),


		type : "search",

	//
	//	event handling
	//

		onDelaySearchChanged : function(event) {
			// FIREFOX:  call searchChanged manually
			if (Event.shortcut == 'return') {
				this.soon(0, "searchChangedEvent");				
			} else {
				this.soon(this.keypressDelay, "searchChangedEvent");
			}
		},
		
		onImmediateSearchChanged : function() {
			this.soon(0, "searchChangedEvent");
		},
		
		onSearchChangedEvent : function() {
			if (this.value === this._lastSearchTerm) return;
			this._lastSearchTerm = this.value;
			this.fire("searchChanged", this.value);
		}
	}
});


Script.loaded("{{hope}}Searchfield.js");
});
