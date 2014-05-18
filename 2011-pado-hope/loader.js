/* 	Load the hope scripts in debug fashion.
	In a production environment, this file would be replaced with a single script file
	which concatenates all of the files listed below.
*/

(function(window){//begin hidden from global scope

window.HOPE_LOAD_START_TIME = new Date().getTime();

// scripts we always load
var scripts = [
		"_debug.js",
		"Browser.js",
		"hope.js",
		"hope-ready.js",
		"XHR.js",
		"Script.js",
		"Function.js",
		"Object.js",
		"Property.js",
		"Number.js",
		"String.js",
		"Date.js",
		"Observable.js",
		"Class.js",
		"Mixin.js",
		"List.js",
		"Attributes.js",
		"Element.js",
		"Element-attach.js",
		"Element-load.js",
		"Element-events.js",
		"Element-style.js",
		"ElementList.js",
		"Event.js",
		"Event-keys.js",
		"Focusable.js",
		"Animation.js",
		"Saveable.js",
		"Dataset.js",
		"Label.js",
		"Icon.js",
		"Action.js",
		"Menu.js",
		"IScroller.js",
		"Notice.js",
		"Panel.js",
		"Section.js",
		"ListViewer.js",
		"ItemViewer.js",
		"Splitter.js",
		"WebView.js",
		"Stack.js",
		"Tab.js",
		"UI.js",
		"Overlay.js",
		"Palette.js",
		"Drag.js",
		"Resizable.js",
		"Reorderable.js",
		"Editor.js",
		"Valued.js",
		"Select.js",
		"Textfield.js",
		"Searchfield.js",
		"Checkbox.js",
		"Output.js",
//		"Combobox.js",
		"CheckSwitch.js",
		"PopoverMenu.js",
		"LinkMenu.js",
		"DirtyBit.js",
		"MessageBoard.js",
		"Filter.js",
	]
;

// Figure out the url of this script and set the `HOPE_PATH` global to its base path.
//	This is so we can make other urls relative to `{{hope}}`.
var script = document.getElementsByTagName("script");
window.HOPE_PATH = script[script.length-1].src;
HOPE_PATH = HOPE_PATH.substr(0, HOPE_PATH.indexOf('loader.js'));


// Write a <script> tag for each of our preload scripts.
//	This will execute them in order.
var i = -1, script;
while (script = scripts[++i]) {
	document.write("<script src='" + HOPE_PATH + script + "'><"+"/script>");
}

})(window);// end hidden from global scope
