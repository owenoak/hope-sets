/*** List of ElementList (like malleable cross between NodeList and Array ***/

//TODO: pick up all standard Element properties and methods so they have the same api???

Script.require("{{hope}}Element.js,{{hope}}List.js", function(){

	new List.Subclass("ElementList");

	// give ElementList the same api as Element
	List.makeAppliers(ElementList, "on,attr,destroy,remove");
	List.makeAppliers(ElementList, "select,selectAll,matches",true);
	List.makeAccessors(ElementList, "width,height,left,top,opacity,selected");
	List.makeAccessors(ElementList, "innerHTML,className,style,bg,radius", true);

	hope.extend(ElementList.prototype, {
		sortBy : function(property) {
			function comparitor(a,b) {
				var aVal = a[property],
					bVal = b[property]
				;
				if (aVal == bVal) return 0;
				if (aVal > bVal) return 1;
				return -1;
			}
			return this.sort(comparitor);
		},
		
		fire : function() {
			for (var i = 0, last = this.length; i < last; i++) {
				var it = this[i];
				if (it) it.fire.apply(it, arguments);
			}
		}
	
	});
	
	// give the native NodeList and HTMLElement array-like-things the ElementList functionality
	// NOTE: some of it (eg: remove) doesn't work...
	hope.extendIf(NodeList.prototype, ElementList.prototype);

	

Script.loaded("{{hope}}ElementList.js");
});// end Script.reqiure
