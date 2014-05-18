/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Generic viewer for 2-level tree-like collection, expressed as a single, flat IndexedList.
//	EG:  a list of brands and issues, expressed as a flat list:
//			brand1/issue1
//			brand1/issue2
//			brand2/issue1
//			brand3/issue1
//			brand3/issue2
//			brand3/issue3
//
//
//	If you want to remember the open state of items in the list, set `rememberOpenStates` to true.
//
//  NOTE: WE ASSUME THE DATA IS ALWAYS SORTED PROPERLY!!!	(TODO: sort before drawing?)
//

Module.define("oak/lib/ui/TreeViewer",
"oak/lib/ui/CollectionListViewer",
function(CollectionListViewer) {

	new Class("TreeViewer", CollectionListViewer, {
		// if true, we can select parent rows.  If not, we can only open/close parents.
		canSelectParents : false,

		// name of the "parent" key on our items (eg: "brandId")
		parentKeyProperty 	: undefined,

		// name of the secondary, "child" key on our items (eg: "issueId")
		childKeyProperty	: undefined,

		// name of the composite key property which encompasses both parentKey and childKey
		keyProperty			: undefined,

		// if `true`, we'll remember the open state of each parent across page reloads
		rememberOpenStates : true,

		// watch for double-click to select
		watchForDoubleClick : true,

		// template for the group that surrounds each parent and its children.
		groupTemplate :  "<div class='group {{openClass}}' key='{{parentKey}}'>{{itemsHTML}}</div>",

		// template for each parent 'row'.
		parentItemTemplate :  "<div class='item parent' key='{{key}}'>{{item.title}}</div>",

		// template for each child 'row'.
		childItemTemplate :  "<div class='item child' key='{{key}}'>{{item.title}}</div>",

		parts : {
			$items		: "LIVE:## .item",
			$groups		: "LIVE:## .group",
		},

		// Given an item in our list, return its corresponding $item.
		// NOTE: you'll likely need to override this.
		itemKeySelector : "[key='{{key}}']",
		get$itemForItem : function(item) {
			if (!item) return undefined;
			var key = item[this.keyProperty];
			var keySelector = this.itemKeySelector.expand({key:key});
			var $item = this.$items.filter(keySelector);
			if ($item.length === 0) return undefined;
			return $item.first();
		},

		// Open states of groups.  Set `rememberOpenStates` to `true` to retain across page loads.
		openStates : Property({
			get : function() {
				if (this.rememberOpenStates) return this.preference("openStates") || [];
				return [];
			},

			set : function(newList) {
				if (this.rememberOpenStates) this.preference("openStates", newList);
			}
		}),

		onShown : function() {
			if (this.$okButton) this.$okButton.addClass("disabled");
			this.asCollectionListViewer("onShown");
		},

	//
	//  event handling
	//

		events : [
			{ selector:"$groups", event:"click", handler:"onGroupClicked" },
		],

		getItemForEvent : function(event, $item) {
			if (!this.items || !this.items.MAP) return undefined;
			var key = $item.attr("key");
			return this.items.MAP[key];
		},

		// Click on the group toggles the group open/closed.
		//	On close, if a child of the group was selected, update selection.
		onGroupClicked : function(event, $group) {
			if (event) event.stop();
			$group.toggleClass("closed");
			var groupIsOpen = !$group.hasClass("closed")

			// remember open state of this item if we're supposed to
			var groupKey = $group.attr("key");
			if (this.rememberOpenStates) {
				var openStates = this.openStates;
				if (groupIsOpen) {
					if (!openStates.contains(groupKey)) openStates.add(groupKey);
				} else {
					openStates.remove(groupKey);
				}
				this.openStates = openStates;
			}

			// update selection if we closed over the selected item
			if (!groupIsOpen && this.selectedItem) {
				var selectedKey = this.selectedItem[this.parentKeyProperty];
				if (selectedKey == groupKey) {
					// if we can select parents, select the parent (which is still visible)
					if (this.canSelectParents) {
						var $parent = $group.children().first();
						var parent = this.getItemForEvent(null, $parent);
						this.select(parent, $parent);
					}
					// otherwise deselect the child
					else {
						this.select(null, null);
					}
				}
			}
		},

		select : function(item, $item) {
			if ($item) {
				var isParent = $item.hasClass("parent");
				if (isParent && !this.canSelectParents) {
// return selected non-selectable parent
					this.asCollectionListViewer("select", [null, null]);
				}
			}
			this.asCollectionListViewer("select");
		},

		markSelectedItem : function(item, $item) {
			// make sure our parent is open
			if (this.selectedItem) {
				if (!$item) $item = this.get$itemForItem(this.selectedItem);
				if ($item) {
					$item.parent().removeClass("closed");
				}
			}
			this.asCollectionListViewer("markSelectedItem", [item, $item]);
		},


		// Given a $parent or $child item, return the $group it belongs to.
		// NOTE: not well defined if $item is not actually a child!
		get$groupForItem : function($item) {
			if (!$item) return undefined;
			while (!$item.hasClass("group")) {
				if ($item.length == 0 || $item[0] == this.$root[0]) return undefined;
				$item = $item.parent();
			}
			return $item;
		},



	//
	//	drawing
	//

		// html for the body
		getHTMLForItems : function(items) {
			if (!items) items = this.items;
			if (!items) return "";

			if (!items.forEach) {
				console.warn(this,".getHTML(): items has no forEach method!");
				return "";
			}
			if (items.length === 0) return "";

			var openStates = this.openStates;
			var html = [], groupItems, lastParent;
			items.forEach(function(item, index) {
				if (!item) return;
				var parentKey = item[this.parentKeyProperty],
					childKey  = item[this.childKeyProperty],
					key		  = item[this.keyProperty]
				;
				// if we've got a different parentKey than last time
				if (parentKey != lastParent) {
					// add the last group to the html
					html.append(this.getGroupHTML(groupItems, lastParent, openStates.contains(lastParent)));
					// reset lastParent
					lastParent = parentKey;
					// restart with a different group
					groupItems = [];
					// add an entry for the parent
					groupItems.append(this.getParentItemHTML(item, parentKey, key));
				}
				// add the entry for the child
				groupItems.append(this.getChildItemHTML(item, parentKey, key));
			}, this);

			// add the entry for the last group
			html.append(this.getGroupHTML(groupItems));

			return html.join("\n");
		},

		// return HTML for a group.  `itemsHTML` is the HTML for all items in the group.
		getGroupHTML : function(itemsHTML, parentKey, isOpen) {
			if (itemsHTML && itemsHTML.join) itemsHTML = itemsHTML.join("\n");
			if (!itemsHTML) return "";
			var subs = {
				parentKey 	: parentKey,
				itemsHTML	: itemsHTML,
				openClass	: (isOpen ? "" : "closed")
			};
			return this.groupTemplate.expand(subs);
		},

		// Return the HTML for a parent 'row'.
		getParentItemHTML : function(item, parentKey, key) {
			var subs = {
				viewer 		: this,
				parentKey 	: parentKey,
				key			: key,
				item 		: item,
			}
			return this.parentItemTemplate.expand(subs);
		},

		// Return the HTML for a child 'row'.
		getChildItemHTML : function(item, parentKey, key) {
			var subs = {
				viewer 		: this,
				parentKey	: parentKey,
				key			: key,
				item 		: item,
			}
			return this.childItemTemplate.expand(subs);
		},


	});	// end new Class("TreeViewer")

	return Class.TreeViewer;
});
