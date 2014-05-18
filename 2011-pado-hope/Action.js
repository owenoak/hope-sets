/* Actions -- button-like things. */

//TEST CHANGE

//TODO:   	set title dynamically, just like we're setting checked?
//TODO:		different event handlers (eg: down, etc)

Script.require("{{hope}}Element-attach.js", function(){

new Element.Subclass("hope.Action", {
	tag : "hope-action",
	properties : {

//TODO: touchStart ???
		listeners : "mousedown,click",

		// named icon to show
		icon : new Attribute({name:"icon", update:true,
			onChange : function(newValue) {
				// make sure we have an icon sub-element
				if (this.getChild("hope-icon") == null) this.prepend(new hope.Icon());
//console.warn(this,"changing icon to ",newValue, this.getChild("hope-icon"));
				return newValue;			
			}
		}),

		// label for the action (user-visible)
		label : new Attribute({name:"label", update:true,
			onChange : function(newValue) {
				// get a pointer to our <hope-label> or create one if necessary
				var label = this.getChild("hope-label") || this.append(new hope.Label());
				label.html = newValue;
//console.warn(this,"changing label to ",newValue, label);
				return newValue;
			}
		}),
		
		// longer description
		description : Getter(function() {
			var description = this.attr("description");
			if (!description) {
				description = this.getChild("hope-description");
				if (description) description = description.html;
			}
			return description;
		}),
		
		// appearance (used for css styling)
		appearance : Attribute({name:"appearance", update:true}),

		// action to do when clicked or our shortcut is pressed
		onActivate : new Attribute({name:"onactivate", type:"event", args:"event", inherit:true}),

		onMousedown : function(event) {
			if (!this.enabled) return;
			this.showActive(true);
			document.body.once("mouseup", this.deactivate, this);
		},
		
		// show as "active" or inactive
		showActive : function(active) {
			if (active == null) active = true;
			if (active)	this.classList.add("active");
			else		this.classList.remove("active");
		},

		onMouseup : function(event) {
			if (this.enabled) this.showActive(false);
		},

		onClick : function(event) {
			if (this.enabled) this.fire("activate", event);
		},
		
		// When our parent is shown, check our visible, enabled and checked attributes.
		//	If we have a showif, enableif or checkif property, that will update it.
		onShown : function() {
			this.visible;
			this.enabled;
			this.selected;
		}
	}
});


Script.loaded("{{hope}}Action.js");
});
