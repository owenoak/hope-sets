/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	A resizer is a widget used to resize one or more child `region` elements of another widget.
//


Module.define("oak/lib/ui/Resizer",
"oak/lib/core/Class,oak/lib/core/Property,oak/lib/ui/Widget,oak/lib/ui/ContextMenu,oak/lib/ui/UIGrid,oak/lib/ui/UIGuides,oak/lib/ui/UIAutoConstrainDrag,oak/lib/jquery/jquery.align,oak/lib/ui/KeyMap",
function(Class, Property, Widget, ContextMenu, UIGrid, UIGuides, UIAutoConstrainDrag, jQueryAlign, KeyMap) {
	new Class("Resizer", "Widget", {

		// Set to `true` to print debug messages about events
		debugEvents : false,

		// Delegate widget that we attach to; the object that gets the callbacks.
		//	You MUST only change this by calling `setDelegate()`
		delegate : undefined,

		// Region elements we have currently selected.
		// NOTE: This list is NOT STABLE -- it changes when selection is updated,
		//		 so you MUST NOT cache this value!
		//		 Instead, if you want a local pointer to it, make a Property.Getter() which points to our value.
		$selection : $(),


		// Selector we'll use to find selectable regions in our delegate.
		//  DEFAULT is that EVERYTHING under the root is selectable.
		//	NOTE:  "##" == the $root element of the delegate widget.
		regionSelector : "## *",
		// events we'll track for page regions
		regionEvents : { "mousedown" : "onRegionDown" },

		// Selector we'll use to determine if things have scrolled,
		//	so we can auto-synchronize the resizer with the scroll.
		//	NOTE:  "##" == the $root element of the delegate widget.
		scrollParentSelector : "##",
		// events we'll track for scroll parent
		scrollParentEvents : { "scroll" : "onParentScrolled" },

		// Selector upon whom a click which is NOT in a region will
		//	be considered a "background" click, deselecting the widget.
		//  NOTE: don't make this the body, or menus/popups/etc will deselect the widget.
		//	NOTE:  "##" == the $root element of the delegate widget.
		backgroundSelector : "ui",
		// events we'll track for background elements
		backgroundEvents : { "mousedown" : "onBackgroundDown" },


	//
	// capabilities
	//
		canSelect				: true,		// Can we select AT ALL?
		multiSelect				: true,		// Can we select more than one thing at once?  Ignored if `canSelect` is false.
		canMove					: true,		// Can we move our regions?
		canResize				: true,		// Can we resize our regions?
		canMoveContents			: false,	// Can we move contents of regions?  (generally only applies to certain region types)
		canCropContents			: false,	// Should we crop contents of regions?  (generally only applies to certain region types)
		canResizeContents		: false,	// Should we resize contents of regions? (generally only applies to certain region types)
		canLock					: true,		// Can we lock our regions?
		lockClass				: "Locked",	// Class applied to regions when we 'lock' them.
		canDuplicate			: true,		// Can we duplicate selected regions?

	//
	//	drag/resize defaults
	//

		// default drag options.  You can override these on `setDelegate()` by setting `dragOptions`
		//	which will be ADDED to these defaults.
		dragOptions : Property.ProtoMap("dragOptions", {
			distance 		: 5,			// min distance before drag
			gridSnap 		: true,			// snap to grid if UI.Grid.snap is true
			autoConstrain 	: true,			// dynamically constrain axis if shift key is down
		}),

		// default resize options.  You can override these on `attchTo()` by passing `targetOptions.resizeOptions`.
		resizeOptions : Property.ProtoMap("resizeOptions", {
			distance 	: 5,
			handles 	: "all",
			gridSnap 	: true,
			minWidth	: 1,
			minHeight	: 1
		}),



	//
	//	widget lifecycle
	//

		// template to use as HTML for the Resizer by default
		widgetTemplate : "<div id='{{id}}' class='Resizer'></div>",
		parts : {},

		events : [
	//		{ selector:"body", event:"mousedown", handler:"onBodyDown" },
			{ selector:"$root", event:"mousedown", handler:"onMouseDown" },		// figure out which handle we went down in
			{ selector:"$root", event:"mouseup", handler:"onMouseUp" },			// clear handle
			{ selector:"$root", event:"click", handler:"onClick" },
			{ selector:"$root", event:"contextmenu", handler:"onContextMenu" },
			{ selector:document, event:"keydown", handler:"onKeyDown"},
			{ selector:document, event:"keyup", handler:"onKeyUp"},
		],

		onReady : function() {
			this.asWidget("onReady");
		},



	//
	//	dealing with selection
	//

		// Return `true` if:
		//	- our delegate is defined AND
		//	- our $selection is not empty
		anySelected : Property.Getter(function() {
			return (this.delegate != null && this.$selection.length != 0);
		}),

		// Return `true` if any of the `$elements` is already selected.
		isSelected : function($elements) {
			var list = this.$selection.toArray();
			var element, i = -1;
			while (element = $elements[++i]) {
				if (list.contains(element)) return true;
			}
			return false;
		},

		// Return the subset of items in $elements which ARE NOT already selected.
		unselected : function($elements) {
			// figure out what items, if any, are not already in our selected list
			var selection = this.$selection.toArray();
			var results = [];
			$elements.each(function(index, region) {
				if (!selection.contains(region)) results.append(region);
			});
			return $(results);
		},

		// Return the subset of items in $elements which ARE already selected.
		selected : function($elements) {
			// figure out what items, if any, are not already in our selected list
			var selection = this.$selection.toArray();
			var results = [];
			$elements.each(function(index, region) {
				if (selection.contains(region)) results.append(region);
			});
			return $(results);
		},

		// Select zero or more regions ONLY, specified as a jQuery vector, delegating eventually down to `setSelection()`.
		// NOTE:  Clears current selection.  If you dont't want that, use `addToSelection()` instead.
		// Returns the selection after the change.
		// Creates an undo record, unless you pass a truthy value (eg: "NOUNDO") to `suppressUndo`.
		select : function($newSelection, suppressUndo) {
			// if we don't allow multi-select, get just the first $region passed in
			if (this.multiSelect == false) $newSelection = $newSelection.first();
			return this.setSelection($newSelection, suppressUndo);
		},

		// Add one or more regions to the current selection, specified as a jQuery vector.
		// NOTE:  ADDS TO current selection.
		// Returns the selection after the change.
		// Creates an undo record, unless you pass a truthy value (eg: "NOUNDO") to `suppressUndo`.
		addToSelection : function($regions, suppressUndo) {
			if (!$regions || !$regions.length) return this.$selection;

			// vector of things to be selected at the end of the day
			var $newSelection;

			// if we allow multi-selection...
			if (this.multiSelect) {
				// ...add the regions to our current selection
				$newSelection = this.$selection.add($regions);
			}
			// if single select, select the first item in $regions
			else {
				$newSelection = $regions.first();
			}

			return this.setSelection($newSelection, suppressUndo);
		},

		// Deselect one or more regions, specified as a jQuery vector.
		// Returns the selection after the change.
		// Creates an undo record, unless you pass a truthy value (eg: "NOUNDO") to `suppressUndo`.
		deselect : function($regions, suppressUndo) {
			if (!$regions) return this.$selection;

			// remove $regions from our current $selection
			var $newSelection = this.$selection.not($regions);
			return this.setSelection($newSelection, suppressUndo);
		},

		// Select ALL regions we can find in the current scope.
		// Returns the selection after the change.
		// Creates an undo record, unless you pass a truthy value (eg: "NOUNDO") to `suppressUndo`.
		selectAll : function(suppressUndo) {
			var $everything = this.all$regions();
			return this.setSelection($everything, suppressUndo);
		},

		// Deselect ALL currently selected regions.
		// Returns the selection after the change.
		// Creates an undo record, unless you pass a truthy value (eg: "NOUNDO") to `suppressUndo`.
		deselectAll : function(suppressUndo) {
			return this.deselect(this.$selection, suppressUndo);
		},

		// Select all regions which intersect the specified GLOBAL rect
		selectByGlobalRect : function(rect, suppressUndo) {
//			console.info("selectByGlobalRect ",rect);
			var $insideRect = this.all$regions().intersectedBy(rect);
			this.select($insideRect, suppressUndo);
		},


	//
	//	internal routines for manipulating selection
	//


		// Set our $selection to a specific set of regions.
		// This does the delta between `$regions` and our current `$selection` and manipulates thing accordingly.
		// Side effects:
		//		- For things which were previously selected but shouldn't be now,
		//			our delegate will get a single `onRegionDeselected` event with the list of what is being deselected.
		//		- For things which were should be selected now but weren't previously,
		//			our delegate will get a single `onRegionSelected` event with the list of what is being selected.
		//		- We'll synchronize the UI to reflect the current selection.
		//		- We'll send our delegate `onSelectionChanged` event.
		//		- We'll trigger an `onSelectionChanged` event directly on us, for direct observers.
		// Creates an undo record, unless you pass a truthy value (eg: "NOUNDO") to `suppressUndo`.
		setSelection : function($regions, suppressUndo) {
			if (!$regions) $regions = $();

			var $oldSelection = this.$selection;

			var deltas = this._getSelectionDeltas($regions, $oldSelection);
			if (!deltas || !deltas.changesRequired) {
				// synchronize before returning!
				this.synchronize();
				return this.$selection;
			}

			// anything in toDeselect should be removed from the selection
			if (deltas.$toDeselect.length) {
				// notify our delegate that additional things have been deselected
				this.callOnRegions("onRegionDeselected", deltas.$toDeselect);
			}

			// anything left from toSelect should be added to the selection
			if (deltas.$toSelect.length) {
				// notify our delegate that additional things have been deselected
				this.callOnRegions("onRegionSelected", deltas.$toSelect);
			}

			// update the selection
			this.$selection = deltas.$regions;

			// synchronize the UI
			this.synchronize();

			// notify our delegate that the selection has changed...
			this.tellDelegate("onSelectionChanged", [this.$selection]);

			// ...and notify any random observers about the change as well.
			$(this).on("selectionChanged", [this.$selection]);

			if (!suppressUndo) {
				// create a new undoable action to update the selection,
				var action = new this.SelectionAction(this, $regions, $oldSelection);
				// but don't execute it (as we've already done the work)
				action.pretend();
			}

			return this.$selection;
		},


		// Synchronize our position and appearance with the position/settings of our current `$selection`.
		// Broken out so you can call `synchronize()` to match the target and resizer when necessary.
		synchronize : function($elements) {
			if (!$elements) $elements = this.$selection;
			// if nothing selected, clear our data structures and hide
			var selectedCount = $elements.length;
			if (selectedCount == 0) {
				if (this.debugEvents) console.debug("resizer.synchronize(",$elements,") nothing selected");
				this.hide();
//console.info("synchronize: no selection");
			} else {
				// calculate and remember the WINDOW rect which contains all of our children
				this.containingRect = Math.integerRect($elements.containingRect(true));
				if (this.debugEvents) console.debug("resizer.synchronize(",$elements,") rect:", this.containingRect);

				// size the resizing frame to the containing rect and show it
				this.$root.css(this.containingRect);
				this.show();

				// add a Locked class if any of our children are locked
				var anyLocked = this.askDelegate("regionIsLocked", [this.$selection]);
				this.$root.toggleClass("Locked", anyLocked);

				// special appearance if we're short (less than 20 px tall) and/or thin (less than 20px wide)
				this.$root.toggleClass("short", this.containingRect.height < 20);
				this.$root.toggleClass("thin", this.containingRect.width < 20);
			}

			UI.toggleClass("oneSelected", selectedCount == 1);
			UI.toggleClass("multiSelected", selectedCount > 1);
			return this;
		},

		// Undo-able selection action.
		// You pass a new set of regions to be selected at the end of the operation(which may be empty)
		//	and we'll figure out the rest based on the current $selection.
		SelectionAction : new Class("ResizerSelectionAction", "Undoable", {
			init : Property.Hidden(function(scope, $newSelection, $oldSelection) {
				var action = this;
				action.$newSelection = $newSelection;
				action.$oldSelection = $oldSelection;
				action.scope = scope;

				action.doit = function() {
					// NOTE: `NOUNDO` here makes sure we don't create ANOTHER undo record
					return this.setSelection(action.$newSelection, "NOUNDO");
				}
				action.undo = function() {
					// NOTE: `NOUNDO` here makes sure we don't create ANOTHER undo record
					return this.setSelection(action.$oldSelection, "NOUNDO");
				}
			}),
			undoTitle : "Undo selection change",
			redoTitle : "Redo selection change"
		}),

		// Convenience routine to make a SelectionAction which updates to the new selection.
		_makeSelectionAction : function($newSelection) {
			// figure out what changes, if any, we have to make to the current selection
			var deltas = this._getSelectionDeltas($newSelection);
			if (!deltas.changesRequired) return;

			// create a new undoable action to update the selection, and execute it
			var action = new this.SelectionAction(this, deltas.$regions);
			return action.execute();
		},


		// Return the delta between $newSelection and $oldSelection (both jQuery vectors) as:
		//	- if there are no changes required, `undefined`
		//	- otherwise, return an object:
		//			{
		//				changesRequired	: <`true` if any changes are required to update the selection>
		//				$regions		: $(list of things which should be selected at the end)
		//				$toSelect 		: $(list of things want to be selected)
		//				$toDeselect 	: $(list of things want to be deselected)
		//			}
		// NOTE: takes delegate selectability into account!
		//
		_getSelectionDeltas : function($newSelection, $oldSelection) {
			if (!this.canSelect || !this.delegate) return undefined;
			if (!$newSelection) $newSelection = $();
			if (!$oldSelection) $oldSelection = this.$selection;

			// remove anything from $newSelection which our delegate tells us should not be selected
			$newSelection = this.regionsWhere("canSelectRegion", $newSelection);

			// figure out what we need to select and what we need to deselect
			var toDeselect = $oldSelection.toArray();
			var toSelect = [];
			$newSelection.each(function(index, region) {
				if (toDeselect.contains(region)) 	toDeselect.remove(region);
				else								toSelect.append(region);
			});

			// return vectors of the necessary deltas.
			return {
				changesRequired : (toSelect.length > 0 || toDeselect.length > 0),
				$regions		: $newSelection,
				$toSelect 		: $(toSelect),
				$toDeselect		: $(toDeselect)
			}
		},

	//
	//	dealing with our "delegate" widget
	//

		// Call this to set our delegate.
		// Pass `properties` to be set on this object
		//	AFTER the old delegate has been released
		//	but BEFORE the newDelegate is set up
		setDelegate : function(newDelegate, properties) {
			// release our current delegate, its events, etc
			if (this.delegate) this._detachFromDelegate();
			if (properties) this.extend(properties);
			this.delegate = newDelegate;
			if (this.delegate) this._attachToDelegate();
		},

		// NOTE: we assume that $target is visible (eg: has real dimensions).
		// See top of file for `targetOptions`.
		_attachToDelegate : function() {
			// set up drag options with a COPY of our dragOptions object.
			var dragOptions = Property.extend({}, this.dragOptions);
			dragOptions.start = this.bind("onDragStarted");
			dragOptions.drag = this.bind("onDragged");
			dragOptions.stop = this.bind("onDragStopped");

			// set up resize options with a COPY of our resizeOptions object.
			var resizeOptions = Property.extend({}, this.resizeOptions);
			resizeOptions.start = this.bind("onResizeStarted");
			resizeOptions.resize = this.bind("onResized");
			resizeOptions.stop = this.bind("onResizeStopped");

			// and set up draggable and resizable via jQueryUI
			this.$root.draggable(dragOptions);
			this.$root.resizable(resizeOptions);

			$("body").append(this.$root);
			this.$root.bringToFront();
			this.show();

			this.synchronize();

			// set up delegate events
			this.addDelegateEvents(this.regionSelector, this.regionEvents);
			this.addDelegateEvents(this.scrollParentSelector, this.scrollParentEvents);
			this.addDelegateEvents(this.backgroundSelector, this.backgroundEvents);

			// notify the delegate that we've latched on
			this.tellDelegate("onResizerAttached", [this]);
		},

		_detachFromDelegate : function() {
			// turn off drag and resize via jQueryUI
			this.$root.draggable("destroy");
			this.$root.resizable("destroy");

			// unhook events
			this.removeDelegateEvents(this.regionSelector, this.regionEvents);
			this.removeDelegateEvents(this.scrollParentSelector, this.scrollParentEvents);
			this.removeDelegateEvents(this.backgroundSelector, this.backgroundEvents);

			// tell the current delegate that we're audi9000
			this.tellDelegate("onResizerReleased", [this]);
		},

		// Get a named method defined on our delegate.
		// Returns `undefined` if delegate isn't set, or doesn't implement the method.
		_getDelegateMethod : function(methodName) {
			var method = (this.delegate ? this.delegate[methodName] : null);
			if (typeof method === "function") return method;
			return undefined;
		},

		// Generic routine to call a method on our delegate, if defined, and pass back the results.
		// No-op which returns `undefined` if delegate is not set or doesn't implement the method.
		tellDelegate : function(methodName, args) {
			var method = this._getDelegateMethod(methodName);
			if (method) return method.apply(this.delegate, args);
		},

		// Syntactic sugar for `tellDelegate()`.
		askDelegate : function(methodName, args) {
			var method = this._getDelegateMethod(methodName);
			if (method) return method.apply(this.delegate, args);
		},


		// Call a method on our delegate for each of a set of regions.  Returns array of results.
		// You can pass a list of regions, or we'll assume you want the current selection.
		// NOTE: you can mutate the selection during the delegate calls without ill effect.
		callOnRegions : function(methodName, regions) {
			if (!regions) regions = this.$selection;
			if (regions instanceof jQuery) regions = regions.toArray();

			var results = [], method = this._getDelegateMethod(methodName);
			if (method && regions.length) {
				var region, i = -1;
				while (region = regions[++i]) {
					results[i] = method.apply(this.delegate, [$(region), this]);
				}
			}
			return results;
		},

		// Return A NEW ARRAY of the subset of regions where delegate[methodName] is truthy or 0.
		// If you don't pass a `regions` array, we'll start with selected regions.
		regionsWhere : function(methodName, regions) {
			if (!regions) regions = this.$selection;
			if (regions instanceof jQuery) regions = regions.toArray();

			if (regions.length == 0) return $();
			// get method, if not defined, assume all regions match
			var method = this._getDelegateMethod(methodName);
			if (!method) return regions.clone();

			var region, i = -1, results = [];
			while (region = regions[++i]) {
				var result = method.apply(this.delegate, [$(region), this]);
				if (result == false || result == null) continue;
				results.append(region);
			}
			return $(results);
		},

		// Return a property of the delegate.
		// Returns `undefined` if delegate is not set.
		getDelegateProperty : function(prop) {
			return (this.delegate ? this.delegate[prop] : undefined);
		},


		// Return delegate offsets



	//
	//	finding elements in our delegate
	//

		// Return a jQuery vector of all regions currently in scope.
		all$regions : function() {
			return this._findForDelegate(this.regionSelector);
		},

		// Given a selector which MAY be local to our delegate, return a the list of matching elements.
		//
		// If "##" is present in the selector, returns things local to our `delegate.$root` (including the root itself).
		// Otherwise treat it as a global selector.
		//
		// Returns an empty jQuery vector if selector isn't defined, selector contains "##" but $root isn't set, etc.
		_findForDelegate : function(selector) {
			var selector = this._splitDelegateSelector(selector);
			if (!selector.$root) return $();
			if (!selector.selector) return selector.$root;
			return selector.$root.find(selector.selector);
		},


		// Given a `selector` which MAY be local to our delegate,
		//	return the tuple [<root element>, <transformed selector>].
		//
		// NOTE: you can pass a jQuery object or a POJO and get back a meaninful result.
		//
		// The string "##" in the selector indicates that the <root element> is our `delegate.$root` (which may be undefined).
		// Otherwise <root element> will be the <body>.
		_splitDelegateSelector : function(selector) {
			if (!selector) return {};
			var $root;
			if (typeof selector == "string") {
				if (selector === "body") {
					return {$root : $(selector)};
				}
				else if (selector.contains("##")) {
					var $root = (this.delegate ? this.delegate.$root : undefined);
					selector = selector.replace("##", "");
				}
				else {
					$root = $("body");
				}
				selector = selector.trim();
			} else {
				$root = $(selector);
				selector = undefined;
			}
			return {$root:$root, selector:selector}
		},

	//
	//	hooking up browser events to our delegate (and its children)
	//
		// Add a set of events TO BE CALLED ON US to the element(s) referenced by delegateSelector.
		// If `live` is `false`, this will be applied directly (eg: for onscroll events).
		// Otherwise it will be applied by delegation.
		addDelegateEvents : function(delegateSelector, map, live) {
			var selector = this._splitDelegateSelector(delegateSelector);
			if (live == null) live = true;
			if (!selector.selector) live = false;

			var $root = selector.$root;
			if (!$root || $root.length == 0) return;

			for (event in map) {
				// NOTE: this uses `this.bind()` which returns the same function repeatedly
				var method = this.bind(map[event]);
				if (event == "scroll") {
					$(selector.selector).on(event, method);
				} else if (live) {
					$root.on(event, selector.selector, method);
				} else {
					$root.on(event, method);
				}
			}
		},

		// Remove a set of events set up by `addDelegateEvent`
		removeDelegateEvents : function(delegateSelector, map, live) {
			var selector = this._splitDelegateSelector(delegateSelector);
			if (live == null) live = true;
			if (!selector.selector) live = false;

			var $root = selector.$root;
			if (!$root || $root.length == 0) return;

			for (event in map) {
				var method = this.bind(map[event]);
				if (event == "scroll") {
					$(selector.selector).off(event, method);
				} else if (live) {
					$root.off(event, selector.selector, method);
				} else {
					$root.off(event, method);
				}
			}
		},




	//
	// programmatic manipulation
	//

		// Call a named jQuery method for each of our selected regions which can be moved.
		// If you pass an `undoActionTitle`, we'll create an undo record automatically.
		_callMoveRegionMethod : function(methodName, args, undoActionTitle) {
			// if space key is down, move region contents rather than region itself
			if (UI.keys.SPACE) return this._callRegionMoveContentsMethod(methodName, args, undoActionTitle);

			var $moveables = (this.canMove ? this.regionsWhere("canMoveRegion") : $());
			if (!$moveables.length) return false;

			if (undoActionTitle) {
				// create the undo action -- this also sets up initial state for each element
				var action = new this.AdjustRegionStylesAction(this, $moveables, undoActionTitle);
			}

			// actually do the thing by applying the jQuery function of the same name
			$moveables[methodName].apply($moveables, args);

			if (undoActionTitle) {
				// set the undo action up with the state after the move...
				action.updateAfterMove();
				// ...and pretend to execute the action (as we've already done the work)
				action.pretend();
			}

			this.synchronize();
			this.tellDelegate("onRegionMoved", [$moveables]);
			return true;
		},


		// Call a named jQuery method for each of our selected regions which can be its CONTENTS.
		// If you pass an `undoActionTitle`, we'll create an undo record automatically.
		_callRegionMoveContentsMethod : function(methodName, args, undoActionTitle) {
			var $moveables = (this.canMoveContents ? this.regionsWhere("canMoveRegionContents") : $());
			if (!$moveables.length) return false;

			if (undoActionTitle) {
				// create the undo action -- this also sets up initial state for each element
				var action = new this.AdjustRegionStylesAction(this, $moveables, undoActionTitle);
			}

			// actually do the thing by applying the jQuery function of the same name
			$moveables[methodName].apply($moveables, args);

			if (undoActionTitle) {
				// set the undo action up with the state after the move...
				action.updateAfterMove();
				// ...and pretend to execute the action (as we've already done the work)
				action.pretend();
			}

			this.synchronize();
			this.tellDelegate("onRegionMoved", [$moveables]);
			return true;
		},



		// Undo-able region move action for a set of regions.
		// You pass the list of
		AdjustRegionStylesAction : new Class("AdjustRegionStylesAction", "Undoable", {
			init : Property.Hidden(function(scope, $moved, actionTitle) {
				var action = this;
				action.$moved = $moved;
				action.beforeStyles = this.getStyles($moved);
				action.scope = scope;
				this.undoTitle = "Undo "+(actionTitle || "Adjust Regions");
				this.redoTitle = "Redo "+(actionTitle || "Adjust Regions");

				action.doit = function() {
					action.setStyles(action.$moved, action.afterStyles);
					action.scope.synchronize();
				}
				action.undo = function() {
					action.setStyles(action.$moved, action.beforeStyles);
					action.scope.synchronize();
				}
			}),
			undoTitle : "Undo move",
			redoTitle : "Redo move",

			// Call this after your transform, before executing the action.
			updateAfterMove : function() {
				this.afterStyles = this.getStyles(this.$moved);
			},

			// Return a list of style attribute for each $thing.
			getStyles : function($things, styles) {
				var styles = [];
				$things.each(function(index, thing) {
					styles[index] = thing.getAttribute("style") || "";
				}).toArray();
				return styles;
			},

			// Given an array of $things & an array of style strings,
			//	set each $thing's entire style attribute to the corresponding string.
			setStyles : function($things, styles) {
				$things.each(function(index, thing) {
					thing.setAttribute("style", styles[index]);
				});
			}
		}),


		// Nudge all selected regions a certain `amount` in the specified `direction` (if any can be moved).
		nudge : function(direction, amount) {
			return this._callMoveRegionMethod("nudge", arguments, "Nudge");
		},

		// Nudge contents of selected regions a certain `amount` in the specified `direction` (if any can be moved).
		nudgeContents : function(direction, amount) {
			return this._callRegionMoveContentsMethod("nudge", arguments, "Nudge Contents");
		},


		// Align the top edge of all selected regions (if any can be moved).
		alignTops : function() {
			var globalTop = this.containingRect.top;
			return this._callMoveRegionMethod("alignTops", [globalTop], "Align Tops");
		},

		// Align the vertical center of all selected regions (if any can be moved).
		alignVerticalCenters : function() {
			var globalCenter = Math.floor(this.containingRect.top + (this.containingRect.height/2));
			return this._callMoveRegionMethod("alignVerticalCenters", [globalCenter], "Align Vertical Centers");
		},

		// Align the bottom edge of all selected regions (if any can be moved).
		alignBottoms : function() {
			var globalBottom = this.containingRect.top + this.containingRect.height;
			return this._callMoveRegionMethod("alignBottoms", [globalBottom], "Align Bottoms");
		},

		// Align the left edge of all selected regions (if any can be moved).
		alignLefts : function() {
			var globalLeft = this.containingRect.left;
			return this._callMoveRegionMethod("alignLefts", [globalLeft], "Align Lefts");
		},

		// Align the horizontal center of all selected regions (if any can be moved).
		alignHorizontalCenters : function() {
			var globalCenter = Math.floor(this.containingRect.left + (this.containingRect.width/2));
			return this._callMoveRegionMethod("alignHorizontalCenters", [globalCenter], "Align Horizontal Centers");
		},

		// Align the right edge of all selected regions (if any can be moved).
		alignRights : function() {
			var globalRight = this.containingRect.left + this.containingRect.width;
			return this._callMoveRegionMethod("alignRights", [globalRight], "Align Rights");
		},


		// Distribute horizontally.
		// NOTE: we do this so there's an even amount of space in between each element.
		distributeHorizontally : function() {
			var left = this.containingRect.left;
			var right = this.containingRect.left + this.containingRect.width;
			return this._callMoveRegionMethod("distributeHorizontally", [left, right], "Distribute Horizontally");
		},

		// Distribute vertically.
		// NOTE: we do this so there's an even amount of space in between each element.
		distributeVertically : function() {
			var top = this.containingRect.top;
			var bottom = this.containingRect.top + this.containingRect.height;
			return this._callMoveRegionMethod("distributeVertically", [top, bottom], "Distribute Vertically");
		},

		// Space apart horizontally, putting `margin` pixels between each one.
		// NOTE: we do this so there's an even margin of space in between each element.
		spaceHorizontally : function(margin) {
			if (margin == undefined) {
				var defaultMargin = this.preference("horizontalSpace") || 10;
				UI.prompt("Number of pixels between each item?", defaultMargin)
					.done(function(margin) {
						margin = parseInt(margin);
						if (!isNaN(margin)) this.spaceHorizontally(margin);
					}.bind(this));
				return;
			}
			this.preference("horizontalSpace", margin);
			return this._callMoveRegionMethod("spaceHorizontally", [margin], "Space Horizontally");
		},

		// Space apart vertically, putting `margin` pixels between each one.
		// NOTE: we do this so there's an even margin of space in between each element.
		spaceVertically : function(margin) {
			if (margin == undefined) {
				var defaultMargin = this.preference("verticalSpace") || 10;
				UI.prompt("Number of pixels between each item?", defaultMargin)
					.done(function(margin) {
						margin = parseInt(margin);
						if (!isNaN(margin)) this.spaceVertically(margin);
					}.bind(this));
				return;
			}
			this.preference("verticalSpace", margin);
			return this._callMoveRegionMethod("spaceVertically", [margin], "Space Vertically");
		},





	//
	//	normal event handling
	//

		// HACKY: we capture mouseDown so we can figure out which handle they started dragging from.
		// `this.resizeHandle` will be the name of the side/corner:  `se` or `w` or `null` if not resizing.
		onMouseDown : function(event) {
			var handleName = null;
			var match = event.target.className.match(/ui-resizable-([nsew][nsew]?)\b/);
			if (match) handleName = match[1];
			this.resizeHandle = handleName;

			// skip selection processing if clicking in a resize handle
			if (this.resizeHandle) {
				if (this.debugEvents) console.info("resizer.onMouseDown(",event,"): down in handle:", this.resizeHandle);
				return;
			}


			// what is the selectable region under the mouse?
			var $mouseRegion = this.all$regions().containingEventPoint(event).last();
			// if nothing, translate to a background click
			if ($mouseRegion.length === 0) {
				if (this.debugEvents) console.info("resizer.onMouseDown(",event,"): starting background drag");
				this.onBackgroundDown(event);
			}
			// if it's in not in our $selection, or in our $parentSelection
			//	delegate to it (which will select it)
			else if (!$mouseRegion.is(this.$selection) && !$mouseRegion.is(this.$parentSelection)) {
				if (this.debugEvents) console.info("resizer.onMouseDown(",event,"): delegating to unselected region ",$mouseRegion);
				this.onRegionDown(event, $mouseRegion);
			} else {
				if (this.debugEvents) console.info("resizer.onMouseDown(",event,"): mouse is inside existing selection");
				// NOTE: we keep the selection the same in this case!
			}
		},

		onMouseUp : function(event) {
			if (this.debugEvents) console.info("resizer.onMouseUp(",event,")");
			delete this.resizeHandle;
		},

		onClick : function(event) {
			if (this.debugEvents) console.info("resizer.onClick(",event,")");
			this.tellDelegate("onSelectedRegionClick", [event, this.$selection]);
		},

		onContextMenu : function(event) {
			if (this.debugEvents) console.info("resizer.onContextMenu(",event,")");
			this.tellDelegate("onContextMenu", [event, this.$selection]);
			event.stop();
		},

		// If the command key is down, and exactly one thing is selected,
		//	adjust the contents of the first selected item on drag, rather than the element itself.
		onKeyDown : function(event) {
			if (KeyMap.eventIsFocused(event)) return;

			if (this.debugEvents) console.info("resizer.onKeyDown(",event,")");

			// ALWAYS trap the space key, otherwise the page may scroll (default behavior of space)
			if (UI.keys.SPACE) event.preventDefault();

			// if space is not down, or we've already got a $parentSelection set up, nothing to do
			if (!UI.keys.SPACE || this.$parentSelection) return;

			// only works if 1 element selected
			if (this.$selection.length != 1) return;
			// only works if and if we can move/resize the contents
			if (! (this.canMoveContents || this.canResizeContents) ) return;

			var canMove = this.askDelegate("canMoveRegionContents", [this.$selection]);
			var canResize = this.askDelegate("canResizeRegionContents", [this.$selection]);
			if (!canMove && !canResize) return;

			// if we get here, we have exactly 1 item selected, and it can move or resize
			// so switch the $selection to the first child
			this.$parentSelection = this.$selection;
			this.$selection = this.$selection.children().first();
			this.$root.addClass("adjustingContents");
			UI.addClass("adjustingContents");
			this.synchronize();
//console.warn("setting adjustingContents");
		},

		onKeyUp : function(event) {
			if (KeyMap.eventIsFocused(event)) return;
			if (this.debugEvents) console.info("resizer.onKeyUp(",event,")");
			if (!UI.keys.SPACE && this.$parentSelection) {
//console.warn("removing adjustingContents", UI.keys);
				this.$selection = this.$parentSelection;
				delete this.$parentSelection;
				this.$root.removeClass("adjustingContents");
				UI.removeClass("adjustingContents");
				this.synchronize();
			}
		},


		// Update resizer position when the window is resized.
		onWindowResized : function(event) {
			if (this.debugEvents) console.info("resizer.onWindowResized(",event,")");
			this.synchronize();
		},

		// One of our parents was scrolled -- synchronize the resizer geometry.
		onParentScrolled : function(event) {
			if (this.debugEvents) console.info("resizer.onParentScrolled(",event,")");
			this.synchronize();
		},


	//
	//	event handling on DELEGATE and its children
	//

		// Mouse went down inside a region, select it!
		// NOTE: also delegates to resizer.mousedown event, so we can start dragging on mousedown.
		onRegionDown : function(event, $region) {
			if (!$region) $region = $(event.currentTarget);
			if (this.delegate.$redactorTarget && $region.is(this.delegate.$redactorTarget)) {
				if (this.debugEvents) console.info("resizer.onRegionDown(",event,",",$region,"): down in $redactorTarget: bailing");
				return;
			}
			if (this.debugEvents) console.info("resizer.onRegionDown(",event,",",$region,")");

			// if shift key is down and we can multiSelect
			if (UI.keys.SHIFT && this.multiSelect) {
				// if the thing is already selected
				if (this.isSelected($region)) {
					// remove from the current selection
					this.deselect($region);
				}
				// otherwise add to the selection
				else {
					this.addToSelection($region);
				}
			}
			// single select mode
			else {
				// select ONLY the $region
				this.select($region);
			}
			event.stop();

			this.$root.trigger(event);

			// HACKY:  Send the event to the resizer's drag start
			//			this lets us start dragging on mousedown!
			this.$root.data().uiDraggable._mouseDown(event);

			// stop further processing or we'll go to the onBackgroundDown
			event.stop();
		},


	//
	//	background events
	//

		DRAG_SELECTION__EVENTS : {
			"mousemove" : "onSelectionRectMove",
			"mouseup"	: "onSelectionRectUp"
		},

		// The background was clicked.
		// Start selection rectangle processing.
		onBackgroundDown : function(event) {
			// if currently editing text in a text region, bail immediately
			if (this.delegate.$redactorTarget) {
				if (this.debugEvents) console.info("resizer.onBackgroundDown(",event,"): background down while $redactorTarget: bailing");
				return;
			}
			if (this.debugEvents) console.info("resizer.onBackgroundDown(",event,")");

			// reset selection rectangle bidness
			this.clearSelectionRect();

			// add mousemove/mouseup events to the body element
			this.addDelegateEvents(document, this.DRAG_SELECTION__EVENTS);

			// kick off selection
			this._selectionInfo = {
				$startSelection : this.$selection,
				start : {
					x : event.clientX,
					y : event.clientY
				}
			};

			// clear current selection WITHOUT creating an undo record
			//	we'll create the selection rect on mouseUp
			this.deselectAll("NOUNDO");
		},


		// Mouse moved while we were dragging on the background.
		onSelectionRectMove : function(event) {
			var selectionInfo = this._selectionInfo;
			if (this.debugEvents) console.info("resizer.onSelectionRectMove(",event,"): selectionInfo=",selectionInfo);

			// get end coordinates
			selectionInfo.end = {
				x : event.clientX,
				y : event.clientY
			};

			// don't draw selection rect until we move at least 5 pixels
			if (!selectionInfo.$root) {
				if (   (Math.abs(selectionInfo.start.x - selectionInfo.end.x) > 5)
					|| (Math.abs(selectionInfo.start.y - selectionInfo.end.y) > 5))
				{
					// create the _selectionInfo.$root and append it to the top of the body
					selectionInfo.$root = $("<div class='ResizerSelectionRect'></div>");
					$("body").append(selectionInfo.$root);
					selectionInfo.$root.bringToFront();
					if (this.debugEvents) console.info("resizer.onSelectionRectMove(",event,"): starting selection rectangle.  selectionInfo=",selectionInfo);
				}
			}
			if (!selectionInfo.$root) return;

			//
			var left 	= Math.min(selectionInfo.start.x, selectionInfo.end.x),
				width 	= Math.max(selectionInfo.start.x, selectionInfo.end.x) - left,
				top 	= Math.min(selectionInfo.start.y, selectionInfo.end.y),
				height 	= Math.max(selectionInfo.start.y, selectionInfo.end.y) - top
			;
			// selection rectangle in GLOBAL coordinates
			selectionInfo.rect = {
				left:left,
				top:top,
				width:width,
				height:height
			};

			selectionInfo.$root.css(selectionInfo.rect);

			// update the selection, but don't create an undo record
			// (we'll set up the undo once at the end in mouseup)
			this.selectByGlobalRect(selectionInfo.rect, true);
		},


		// Mouse went up while we were dragging on the background.
		// If our `selctionCSS` is set, select all regions that fall in that rectangle.
		onSelectionRectUp : function(event) {
			var selectionInfo = this._selectionInfo;
			if (this.debugEvents) console.info("resizer.onSelectionRectUp(",event,"): selectionInfo=",selectionInfo);
			if (!selectionInfo) return;

			// restore the original selection WITHOUT UNDO
			this.setSelection(selectionInfo.$startSelection, "NOUNDO");

			// if we have a rectangle to select (eg: moved more than 5 pixels)
			if (selectionInfo.rect) {
				// do the "final" selection WITH UNDO
				this.selectByGlobalRect(selectionInfo.rect);
			}
			// otherwise "lock in" the deselect all WITH UNDO
			else {
				this.deselectAll();
			}
			this.clearSelectionRect();
		},

		// Clear selection rect properties.
		//	Called before we start selecting, and after the mouse goes up while selecting.
		clearSelectionRect : function() {
			if (this.debugEvents) console.info("resizer.clearSelectionRect()");
			this.removeDelegateEvents(document, this.DRAG_SELECTION__EVENTS);
			if (!this._selectionInfo) return;
			if (this._selectionInfo.$root) this._selectionInfo.$root.remove();
			delete this._selectionInfo;
		},


	//
	//	dragging setup & behavior
	//
		onDragStarted : function(event, dragInfo) {
			if (this.debugEvents) console.info("resizer.onDragStarted(",event,",",dragInfo,")");
// TODO: SHIFT FOR CONSTRAIN IS KINDA EFFED
			if (!this.anySelected) return;

			// elements to move
			var $elements = this.$selection;

			// initialize drag settings
			// NOTE: put everything involved with dragging on this object, so we can clear it easily
			var settings = {};

			// special behavior exactly one item selected:
			var oneItemSelected = ($elements.length == 1);
			if (oneItemSelected) {
				// if command key is down and we can move region contents, move contents instead
				if (this.canMoveContents && UI.keys.SPACE && this.askDelegate("canMoveRegionContents",[$elements])) {
					settings.action = "dragContents";

					// remember old gridSnap, cause we might turn it off
					settings.gridSnap = UI.Grid.snap;
					settings.guideSnap = UI.Guides.snap;

					// turn off grid + guides when moving contents
					//	(we'll turn them back on later)
					UI.Grid.snap = false;
					UI.Guides.snap = false;

					// tolerance for snapping to top-left corner
		//TODO: get this from UIGuides
					settings.tolerance = 5;
				}
			}

			if (!settings.action) {
				if (this.canDuplicate && UI.keys.ALT) {
					// get the sub-set of regions which the delegate says we can duplicate
					var $dupeables = this.regionsWhere("canDuplicateRegion");
					// if there are any, duplicate and move those.
					// (note: if there are none, we'll skip the duplicate and just move the originals).
					if ($dupeables.length > 0) {
						var $dupes = this.delegate.duplicateRegions($dupeables, "NOUNDO");
						if ($dupes && $dupes.length) {
							settings.duplicated = true;
							settings.$originals = $elements;
							$elements = this.$selection;
						}
					}
				}

				// if any part of the selection is locked, we don't want to move at all
				var anyLocked = this.askDelegate("regionIsLocked", [$elements]);
				if (anyLocked) return;

				// knock out anything that our delegate doesn't want moved
				//	eg: things which are locked...
				$elements = this.regionsWhere("canMoveRegion", $elements);

				// nothing to drag, bail
				if ($elements.length == 0) return;

				$elements.addClass("moving");
				this.$root.addClass("moving");

				// we should be dragging frames
				settings.action = "dragFrames";
			}

			// set up geometry for moving children
			settings.$elements = $elements;
			this.synchronize($elements);
			this._initInteractionGeometry($elements, settings);

			// remember settings
			this._dragSettings = settings;

			// notify the delegate that we've started dragging
			this.tellDelegate("onDragStarted", [$elements, this, settings]);
		},

		onDragged : function(event, dragInfo) {
			if (this.debugEvents) console.info("resizer.onDragged(",event,",",dragInfo,")");

			var settings = this._dragSettings;
			// if we don't have any settings, there's nothing to drag,
			if (!settings || settings.framesLocked) {
				//	so reset the resizer geometry and bail
				dragInfo.position = dragInfo.originalPosition;
				return;
			}

			// move the contents relative to how much the resizer frame moved
			settings.items.forEach(function(item) {
				var styles = Math.integerRect({
					left : dragInfo.position.left - item.frameDelta.left,
					top  : dragInfo.position.top  - item.frameDelta.top,
				});
				item.$element.css(styles);
			});

			this.tellDelegate("onDragged", [settings.$elements, this, settings]);
		},

		onDragStopped : function(event, dragInfo) {
			if (this.debugEvents) console.info("resizer.onDragStopped(",event,",",dragInfo,")");

			var settings = this._dragSettings;
			if (!settings) return;

			var $elements = settings.$elements;

			settings.$elements.removeClass("moving");
			this.$root.removeClass("moving");
			this.tellDelegate("onDragStopped", [$elements, this]);
			delete this._dragSettings;

			// turn back on grid/guide snap, if necessary
			if (settings.gridSnap != null) 	UI.Grid.snap   = settings.gridSnap;
			if (settings.guideSnap != null) UI.Guides.snap = settings.guideSnap;

//console.dir(settings);
			// Create an undo record which will undo/redo the change
			var startRects = settings.items.getProperty("startRect");
			var action = new this.MoveAction(this, $elements, startRects, settings.duplicated, settings.$originals);
			action.execute();
		},

		// Undo-able move action.
		// You pass a list of regions which have been moved and a corresponding list of their start position.
		// We'll automatically remember the current end positions.
		MoveAction : new Class("ResizerMoveAction", "Undoable", {
			init : Property.Hidden(function(resizer, $elements, startRects, duplicated, $originals) {
				var action = this;
				action.scope = resizer;
				// remember where each item ended up
				var endRects = [];
				$elements.each(function(index, element) {
					var $element = $(element);
					endRects.append($element.nonRotatedPosition());
				});

				action.doit = function() {
					// if we had duplicated before,
					if (duplicated) {
						// re-add the duplicated elements
						resizer.delegate.addRegions($elements, null, "NOUNDO");
					}

					$elements.each(function(index, element) {
						var $element = $(element);
						$element.css(endRects[index]);
						resizer.tellDelegate("onRegionMoved", [$element]);
					});

					// update the resizer frame once all is said and done
					this.synchronize();
				}

				action.undo = function() {
					if (duplicated) {
						// remove the duplicated elements
						resizer.delegate.removeRegions($elements, "NOUNDO");
						// and re-select the things that were selected before
						resizer.select($originals, "NOUNDO");

					} else {
						// Move elements back to their start positions.
						$elements.each(function(index, element) {
							var $element = $(element);
							$element.css(startRects[index]);
							resizer.tellDelegate("onRegionMoved", [$element]);
						});
					}

					// update the resizer frame once all is said and done
					this.synchronize();
				}
			}),
			undoTitle : "Undo move",
			redoTitle : "Redo move"
		}),


		// Initialize the geometry for moving/resizing the `$elements` and stick in the `settings` object.
		// NOTE: if you change the $selection, this will be invalid!
		_initInteractionGeometry : function($elements, settings) {
			// Since the resizer is globally positioned and the $target likely has an offset parent,
			// figure out the grid snap delta for the $target based on how far offset parent is off the grid
			if (UI.Grid) {
				var offset = $elements.offsetParent().nonRotatedOffset();
				var gridSnapDelta = {
					left : (offset.left % UI.Grid.size),
					top  : (offset.top % UI.Grid.size),
				}
				this.$root.data("ui-draggable").gridSnapDelta = gridSnapDelta;
				this.$root.data("ui-resizable").gridSnapDelta = gridSnapDelta;
			}

			// remember our orignal containingRect
			var outerRect = settings.startRect = this.containingRect;

			// items will be an object with all of the necessary properties we can use to do the move/resize
			settings.items = [];

			$elements.each(function(index, element) {
				var item = settings.items[index] = {};
				var $element = item.$element = $(element);

				// (local) position relative to its offset parent WITH rotation
				item.startRect 	= $element.positionAndSize(true);

				// start size of the element
				item.size = $element.size();

				// relative size of element to the resizeRect
				item.sizeDelta = {
					width 	: (item.size.width  / outerRect.width),
					height	: (item.size.height / outerRect.height)
				}

				// (global) window position
				item.globalPosition 	= $element.nonRotatedOffset();

				// (local) position relative to its offset parent WITHOUT rotation
				item.localPosition 	= $element.nonRotatedPosition();

				// delta between the object's global and local positions
				item.parentOffset = Math.integerRect({
					left : item.globalPosition.left - item.localPosition.left,
					top	 : item.globalPosition.top  - item.localPosition.top,
				});

				// delta between the object's page location and the resizer topleft
				item.resizerOffset = Math.integerRect({
					left : item.globalPosition.left - outerRect.left,
					top  : item.globalPosition.top  - outerRect.top,
				});

				// do different stuff based on what we're supposed to be ding
				var action = settings.action;

				// dragging region frames around (normal drag)
				if (action == "dragFrames") {
					// delta between the page location and the outerRect topleft
					item.frameDelta = Math.integerRect({
						left : item.parentOffset.left - item.resizerOffset.left,
						top  : item.parentOffset.top  - item.resizerOffset.top,
					})
				}

				// dragging region CONTENTS around
				else if (action == "dragContents") {
					// delta between the page location and the outerRect topleft
					item.frameDelta = Math.integerRect({
						left : item.parentOffset.left - item.resizerOffset.left,
						top  : item.parentOffset.top  - item.resizerOffset.top,
					})
				}

				// if we're resizing frame, set up extra stuff
				else if (action == "resizeFrames") {
					// should we rezize the contents of the item as well as its frame?
					item.resizeContents = this.askDelegate("canResizeRegionContents", [$element]);
				}

				// if crop mode is on, check to see if we should crop each item
				else if (action == "cropContents") {
					// should we crop the contents of the item as well as its frame?
					item.cropContents   = this.askDelegate("canCropRegionContents", [$element]);
				}

				// if we're dealing with item contents, set up position/size of the child
				if (item.resizeContents || item.cropContents) {
					// NOTE: only works for a single child!!!
					var $child = item.$child = $element.children().first();
					// if there are NO children (eg: an empty element) then forget this
					if ($child.length === 0) {
						item.resizeContents = item.cropContents = false;
					} else {
						item.childRect = Math.integerRect($child.positionAndSize(true));
					}
				}

//				console.dir(item);

			}.bind(this));
		},




	//
	//	resizing setup & behavior
	//

		// our settings object will have one or more of the following `resizeAction` flags set:
		//		- resizeFrames		: resize frames of all regions to match
		//		- cropContents		: ONE item selected and we should crop its contents (while resizing frames)
		//
		//	each settings.item will have one or more of:
		//		- resizeContents		: resize contents of this item
		//		- cropContents			: crop contents of this item

		onResizeStarted : function(event, resizeInfo) {
			if (this.debugEvents) console.info("resizer.onResizeStarted(",event,",", resizeInfo,")");

			// initialize drag settings
			// NOTE: put everything involved with dragging on this object, so we can clear it easily
			var settings = {};
			settings.resizeHandle = this.resizeHandle;

			var $elements = this.$selection;
			var aspectResize = false;

			// special behavior exactly one item selected (cropContents)
			if ($elements.length == 1) {
				// if SPACE key is down and we can resize this region's contents, do that
				if (this.canMoveContents && UI.keys.SPACE && this.askDelegate("canResizeRegionContents",[$elements])) {
					settings.action = "resizeContents";
					aspectResize = this.askDelegate("shouldAspectResizeRegion",[$elements]);

					// remember old gridSnap, cause we're turning it off
					settings.gridSnap = UI.Grid.snap;
					settings.guideSnap = UI.Guides.snap;

					// turn off grid + guides when moving contents
					//	(we'll turn them back on later)
					UI.Grid.snap = false;
					UI.Guides.snap = false;
				}
				// if ALT key is down and we can crop this region's contents, do that
				else if (this.canCropContents && UI.keys.ALT && this.askDelegate("canCropRegionContents",[$elements])) {
					settings.action = "cropContents";
				}
			}

			// set the aspect ratio resize if necessary
			// HACKY: just setting the resizable "aspectRatio" option doesn't do it.  :-(
			var data = resizeInfo.originalElement.data("ui-resizable");
			if (data) data._aspectRatio = aspectResize;


			if (!settings.action) {
				// if we can't resize at all, bail
				if (!this.canResize) return;

				// knock out anything that our delegate doesn't want moved (eg: which are locked)
				// and if nothing left to resize, bail
				$elements = this.regionsWhere("canResizeRegion", $elements);
				if ($elements.length === 0) return;

				settings.action = "resizeFrames";
			}

			// set up geometry for moving children
			settings.$elements = $elements;
			this.synchronize();
			this._initInteractionGeometry($elements, settings);

			// remember settings
			this._resizeSettings = settings;

			$elements.addClass("resizing");
			this.$root.addClass("resizing");

			// notify the delegate that we've started dragging
			this.tellDelegate("onResizeStarted", [$elements, this, settings]);

//console.group("resize settings")
//console.dir(settings);
//console.groupEnd();
		},

		onResized : function(event, resizeInfo) {
			if (this.debugEvents) console.info("resizer.onResized(",event,",", resizeInfo,")");

			// NOTE: ResizeInfo.size and resizeInfo.originalSize DO NOT take resizer border into account!
			//		 BAD jQuery, BAD!!!

			var resizer = this;
			var settings = this._resizeSettings;
			// if target is locked, reset resizer to its original dimensions
			if (!settings) {
				this.$root.css(this.containingRect);
				return;
			}

			// fraction of resizers original size vs current size
			var outerSize = this.$root.size();
			var resizerDelta = {
				width  : outerSize.width  / settings.startRect.width,
				height : outerSize.height / settings.startRect.height,
			}

//console.warn(settings.action);
			settings.items.forEach(function(item) {
				// if cropping
				if (item.cropContents) {
					var size = {};
					if (settings.resizeHandle.contains("n")) {
						var delta = outerSize.height - settings.startRect.height;
						size.top = Math.floor(item.childRect.top + delta);
					}
					if (settings.resizeHandle.contains("w")) {
						var delta = outerSize.width - settings.startRect.width;
						size.left = Math.floor(item.childRect.left + delta);
					}
					// nothing to do for "e" and "s" -- we'll crop automatically
					size = Math.integerRect(size);
					item.$child.css(size);
				}

				// if we're resizing this item's contents, multiply startDimensions by the resizer's change in width
				// NOTE: this maintains aspect ratio automatically
				else if (item.resizeContents) {
					var delta = resizerDelta.width;
					var newRect = Math.integerRect({
						left   : item.childRect.left	 * delta,
						top    : item.childRect.top  	 * delta,
						width  : item.childRect.width    * delta,
						height : item.childRect.height   * delta,
					});
					item.$child.css(newRect);
				}

				// ALWAYS resize the frame
			// console.warn(resizeInfo.position, item.parentOffset, item.resizerOffset, resizerDelta);
				var styles = Math.integerRect({
					left	: (resizeInfo.position.left - item.parentOffset.left) + (item.resizerOffset.left * resizerDelta.width),
					top 	: (resizeInfo.position.top  - item.parentOffset.top ) + (item.resizerOffset.top  * resizerDelta.height),
					width	: item.size.width    * resizerDelta.width,
					height	: item.size.height   * resizerDelta.height
				});
				item.$element.css(styles);
			});
			// synchronize to adjust the handles in case we're "short" or "thin"
			this.synchronize();

			this.tellDelegate("onResized", [settings.$elements, this]);
		},

		onResizeStopped : function(event, resizeInfo) {
			if (this.debugEvents) console.info("resizer.onResizeStopped(",event,",", resizeInfo,")");

			var settings = this._resizeSettings;
			if (!settings) return;

			settings.$elements.removeClass("resizing");
			this.$root.removeClass("resizing");

			// turn back on grid/guide snap, if necessary
			if (settings.gridSnap != null) 	UI.Grid.snap   = settings.gridSnap;
			if (settings.guideSnap != null) UI.Guides.snap = settings.guideSnap;

			this.tellDelegate("onResizeStopped", [settings.$elements, this]);
			delete this._resizeSettings;

			// Create an undo record which will undo/redo the change
//console.dir(settings);
			var startRects = settings.items.getProperty("startRect");
			var childRects = settings.items.getProperty("childRect");
			var action = new this.ResizeAction(this, settings.$elements, startRects, childRects);
			action.execute();
		},


		// Undo-able move action.
		// You pass a list of regions which have been moved and a corresponding list of their start position.
		// We'll automatically remember the current end positions.
		ResizeAction : new Class("ResizerResizeAction", "Undoable", {
			init : Property.Hidden(function(resizer, $elements, startRects, childRects) {
				var action = this;
				action.scope = resizer;

				// set up the geometry to make quick undo/redo possible.
				var geometry = action.geometry = [];
				$elements.each(function(index, element) {
					var $element = $(element);
					var item = {
						$element 	: $element,
						start		: startRects[index],
						end			: $element.positionAndSize(true),
					};
					if (childRects && childRects[index]) {
						var $child   = $element.children().first();
						item.$child 	= $child;
						item.childStart	= childRects[index];
						item.childEnd	= $child.positionAndSize(true)
					}
					geometry.append(item);
				});

				action.doit = function() {
					geometry.forEach(function(item) {
						item.$element.css(item.end);
						if (item.$child) item.$child.css(item.childEnd);
						resizer.tellDelegate("onRegionResized", [item.$element]);
					});

					// update the resizer frame once all is said and done
					this.synchronize();
				}

				action.undo = function() {
					// Resize elements back to their start sizes.
					geometry.forEach(function(item) {
						item.$element.css(item.start);
						if (item.$child) item.$child.css(item.childStart);
						resizer.tellDelegate("onRegionResized", [item.$element]);
					});

					// update the resizer frame once all is said and done
					this.synchronize();
				}
			}),
			undoTitle : "Undo resize",
			redoTitle : "Redo resize"
		}),



	});	// end new Class("Resizer")

	return Class.Resizer;
});	// end define("oak/lib/ui/Resizer")
