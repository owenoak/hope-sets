/* 
	Add method to HTML's <select> element

*/

Script.require("{{hope}}Element-attach.js", function(){

hope.extend(HTMLSelectElement.prototype, {
	setOptions : function(map) {
		this.options.length = 0;
		if (!map) return;
		
		for (var key in map) {
			this.options[this.options.length] = new Option(map[key], key);
		}
	}
});


Script.loaded("{{hope}}Select.js");
});
