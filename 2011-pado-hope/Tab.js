/* Tabs, tabbars, etc */

Script.require("{{hope}}Section.js", function(){


hope.Action.Subclass("hope.Tab", {
	tag : "hope-tab"
});

hope.Stack.Subclass("hope.TabGroup", {
	tag : "hope-tabgroup",
	properties : {
		itemSelector : "hope-tabselector",
		selectorConstructor : hope.Tab
	}
});


Script.loaded("{{hope}}Tab.js");
});
