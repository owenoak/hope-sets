/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


/*
	Display a little window with all of the keyboard shortcuts currently in play.
*/

Module.define("oak/lib/ui/ShortcutsOverlay",
"oak/lib/ui/UI,oak/lib/ui/Panel,oak/lib/ui/Modal,oak/lib/ui/KeyMap",
function(UI, Panel, Modal, KeyMap) {

	// Shortcuts overlay singleton
	var ShortcutsOverlay = new Panel({
		id : "ShortcutsOverlay",
		mixins : "Modal",
		title : "Keyboard Shortcuts",
		scrollBody 		: true,
		showingClosebox	: true,

		SEPARATOR_TEMPLATE 	: "<tr><td class='separator' colspan='2'><hr></td></tr>",
		ACTION_TEMPLATE		: "<tr><td class='hint'>{{hint}}</td><td class='key'>{{shortcutTitleString}}</td></tr>",
		updateContents : function() {
			var html = ["<table class='shortcuts'>",
//							"<tr><th class='hint'>Undoable</th><th class='key'>HotKey</th></tr>"
			];
			UI.keyMaps.forEach(function(keyMap, index) {
//				if (index != 0) html.push("<tr><td class='separator' colspan='2'><hr></td></tr>");
				keyMap.actions.forEach(function(action) {
					if (action === KeyMap.SEPARATOR) {
						if (html.last() !== this.SEPARATOR_TEMPLATE) html.append(this.SEPARATOR_TEMPLATE);
					}
					if (!action.keys || !action.visible) return;
					html.append(this.ACTION_TEMPLATE.expand(action));
				}, this);
				if (index != UI.keyMaps.length && html.last() !== this.SEPARATOR_TEMPLATE) html.append(this.SEPARATOR_TEMPLATE);
			}, this);
			html.push("</table>");
			html = html.join("\n");
			this.$body.html(html);
		}
	}).draw();

	return ShortcutsOverlay;
});	// end define("oak/lib/ui/ShortcutsOverlay")
