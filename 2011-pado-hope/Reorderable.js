/*** Make an element or class reorderable in its parent context. ***/

Script.require("{{hope}}Element.js", function() {

new Mixin("Reorderable", {
	properties : {
		index : Property({
			get : function() {
				return (this.parentNode ? this.parentNode.elements.indexOf(this) : -1);
			},
			set : function(index) {
				this.moveToIndex(index);
			}
		}),
	
		// move to a specific index
		//	NOTE: this is the same as setting index directly...
		moveToIndex : function(index) {
			var parent = this.parentNode,
				element = parent.elements[index]
			;
			
			if (index === -1 || !element) {
				parent.appendChild(this);
			} else {
				parent.insertBefore(this, element);
			}
			this.fire("reordered", index, this);
		},
	
		//
		//	bring to front/send to back/etc
		//
		moveForwards : function() {
			this.index += 2;
		},
		
		moveBackwards : function() {
			this.index -= 1;
		},
		
		moveToFront : function() {
			this.index = -1;
		},
		
		moveToBack : function() {
			this.index = 0;
		}
	}
});

Script.loaded("{{hope}}Reorderable.js");
});
