/* UI -- this is generally the outside element of the main part of your UI. 
		It's a section so it can have a header, footer, etc.
*/

Script.require("{{hope}}Tab.js", function(){


new hope.TabGroup.Subclass("hope.UI", {
	tag : "hope-ui",
	properties : {}
});


Script.loaded("{{hope}}UI.js");
});
