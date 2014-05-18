/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/*
	Methods to you can call on any jQuery object.

 */


Module.define("oak/lib/jquery/jquery.extensions",
"oak/lib/core/OrderedMap,oak/lib/js/Math",
function(OrderedMap, XMath) {


	//
	//	Syntactic sugar for outputting elements.
	//

	$.extend($.fn, {
		// Return the tag name for the first element in the vector, as a string.
		// Returns the empty string if the vector is empty.
		// NOTE: always returns as lower case (browsers aren't reliable about this).
		tagName : function() {
			return (this.length ? this[0].tagName.toLowerCase() : "");
		},

		// Return the starting tag for the first element in the vector, as a string.
		// `attrList` is an optional list of attributes to be included, in order.
		//		If you don't specify it, you'll likely get all attributes in a random order.
		//  Pass `true` to skipUnknown to get JUST the attributes defined in attrList
		//		 (only applies if outputOrder is specified).
		startTag : function(attrList, skipUnknown) {
			return String.startTag(this.tagName(), this.orderedAttrs(), attrList, skipUnknown);
		},

		// Return the ending tag for the first element in the vector, as a string.
		endTag : function() {
			return String.endTag(this.tagName());
		},

		// return the outerHTML for all elements in the vector, as a string, with no whitespace between
		// TODO: escaping???
		outerHTML : function() {
			var output = [];
			this.each(function(index, element) {
				output.push(element.outerHTML);
			});
			return output.join("");
		},


		// Return outerHTML for all elements in the vector, with indenting applied.
		prettyOuterHTML : function(indent) {
			if (indent == null) indent = "";
			var output = [];
			this.each(function(index, element) {
				// if we've got an element without children, just output it directly
				if (element.children.length === 0) return output.append(element.outerHTML);

				var $element = $(element);
				output.append($element.startTag());
				var kids = $element.children();
				var kidIndent = (indent == "" ? indent : indent + "\t");
				kids.each(function(index, kid) {
					output.append($(kid).prettyOuterHTML(kidIndent));
				});
				output.append($element.endTag())
			});
			return output.join(indent);
		},

		// Return all children of the first node as HTML, trim()ed with indent added between each.
		trimmedChildHTML : function(indent) {
			if (!indent) indent = "";

			var kids = this.children();
			if (!kids.length) return "";

			var childHTML = [];
			kids.each(function(index, kid) {
				childHTML.push(kid.outerHTML);
			});
			return childHTML.join(indent);
		}
	});

	//
	//	form field manipulation
	//
	var FORM_FIELD_TAGS = ["INPUT","SELECT","TEXTAREA"];
	$.extend($.fn, {
		// Is at least one of our elements a form element (input, select, textarea)?
		isAFormField : function() {
			var i = -1, it;
			while (it = this[++i]) {
				var tagName = it.tagName.toUpperCase();
				if (FORM_FIELD_TAGS.contains(tagName)) return true;
			}
			return false;
		}


	});


	//
	//	global event capture (fires before bubbling)
	//

	$.extend($.fn, {
		// Use "addEventListener()" to capture an event before it goes through
		//	normal bubbly event processing (now works in IE9!)
		//
		// NOTE: this does not follow the jQuery "on"/"off" pattern exactly!
		//
		// NOTE: you must pass EXACTLY THE SAME METHOD to releaseEvent() as you did to captureEvent()
		//			(eg: if it's a bound function, pass the same one to both).
		//		 For Widgets, you can use   widget.bind("someFunction") which will repeatedly return the same bound function.
		//
//TODO: exact syntax as .on() and .off()
//TODO: delegation
		captureEvent : function(eventType, method) {
			if (this.length == 0) return method;
			if (!this[0].addEventListener) {
				this.on(eventType, method);
				return method;
			}

			this.each(function(index, element) {
				element.addEventListener(eventType, method, true);
			});

			return method;
		},

		// Release an event which has been captured.
		releaseEvent : function(eventType, method) {
			if (this.length == 0 || !this[0].removeEventListener) return

			this.each(function(index, element) {
				element.removeEventListener(eventType, method, true);
			});
		},

		// Eat events (which optionally match a specific selector) BEFORE they go to sub-elements.
		eatEvent : function(eventType, selector) {
			this.each(function(index, element) {
				var method;
				if (selector) {
					method = function eatIt(event) {
						// walk up from the target to this item (inclusive)
						// if we match the selector, we should eat the event.
						var target = event.target;
						do {
							if ($(target).is(selector)) {
								event.preventDefault();
								event.stopPropagation();
								return;
							}
							target = target.parentNode;
						} while (target && target != element);
					};
				} else {
					method = function eatIt(event) {
						event.preventDefault();
						event.stopPropagation();
					};
				}
				$(element).captureEvent(eventType, method);
			});
		},

		// return true if the event.target is contained by OR IS EQUAL TO on of our elements
		containsEvent : function(event) {
			var target = event.target;
			var element, i = -1;
			while (element = this[++i]) {
				if (element === target || $.contains(element, target)) return true;
			}
			return false;
		},

		// return true if one of our elements contains the POINT of the mouse event
		containsEventPoint : function(event, ignoreRotation) {
			var point = {left:event.clientX, top:event.clientY};
			return this.containsPoint(point, ignoreRotation);
		},

		// return true if the WINDOW `point` coordinate {left, top} is inside one of our elements
		containsPoint : function(point, ignoreRotation) {
			if (!point || point.left == null || point.top == null) return false;
			return this.is(function(index) {
				var rect = $(this).containingRect(ignoreRotation);
				return Math.rectContainsPoint(rect, point);
			});
		},

		// Return vector of all elements which contain the GLOBAL/WINDOW point {left, top}
		containingEventPoint : function(event, ignoreRotation) {
			var point = {left:event.clientX, top:event.clientY};
			return this.containingPoint(point, ignoreRotation);
		},
		containingPoint : function(point, ignoreRotation) {
			if (!point || point.left == null || point.top == null) return $();
			return this.filter(function(index) {
				var rect = $(this).containingRect(ignoreRotation);
				return Math.rectContainsPoint(rect, point);
			});
		},
	});


	// Event.stop() does both event.stopPropagation() and event.preventDefault() for you.
	$.Event.prototype.stop = function() {
		this.preventDefault();
		this.stopPropagation();
		// if we're a derived event (eg: sort or drop) stop the original event as well
		if (this.originalEvent.stop && this != this.originalEvent) this.originalEvent.stop();
	}


	// GAHHH -- Firefox reports element.attributes in REVERSE ORDER
	//			which messes up our XML <-> String processing.
	//			Test to see if this is the case.
	var testElement = $("<test a='1' b='2'/>")[0];
	var firstAttributeName = testElement.attributes[0].name;
	Browser.attributesOutputInReverseOrder = !(firstAttributeName === "a");
//	console.info(firstAttributeName, Browser.attributesOutputInReverseOrder);

	//
	//	attributes, class names, etc
	//
	$.extend($.fn, {
		// Return true if the first element is NOT `display:none`.
		// NOTE: in contrast to the `:visible` selector, this only checks the current element, not its parents.
		isDisplayed : function() {
			if (this.length === 0) return false;
			return (this.css("display") !== "none");
		},


		// Return true if ALL elements match the given selector.
		// (As opposed to $().is() -- which will be true if ANY match the selector).
		all : function(selector) {
			return (this.filter(selector).length == this.length);
		},

		// Return all attributes of the first object in a jQuery vector as a map.
		//	If you pass a "newAttrs" object, those attributes will be added to the object as well
		//		OVERRIDING ANY CURRENT VALUES.
		attrs : function(newAttrs) {
			var map = {}, element = this[0], index, attributeNode;
			if (element) {
				// if new attributes specified, add them first
				if (newAttrs) {
					for (var key in newAttrs) {
						element.setAttribute(key, newAttrs[key]);
					}
				}

				// now enumerate all current attrs of the element and return them
				if (Browser.attributesOutputInReverseOrder) {
					i = element.attributes.length;
					while (attributeNode = element.attributes[--i]) {
						map[attributeNode.nodeName] = attributeNode.value;
					}
				} else {
					i = -1;
					while (attributeNode = element.attributes[++i]) {
						map[attributeNode.nodeName] = attributeNode.value;
					}
				}
			}
			return map;
		},

		// Return a map of only the named attributes passed in from the first element in this vector.
		attrsFromList : function(attrList) {
			var attrs = this.attrs(), map = {}, i = -1, key;
			while (key = attrList[++i]) {
				map[key] = attrs[key];
			}
			return map;
		},

		// Return all attributes of the first object in a jQuery vector as an OrderedMap.
		// NOTE: We will lowercase all attributes names in the attributes and in the keys.
		//		 Since browsers generally mangle attribute case, this is safer.
		// NOTE: there is no setting here, just getting.
		orderedAttrs : function() {
			var map = new OrderedMap(), element = this[0], i = -1, attributeNode;
			if (element) {
				// now enumerate all current attrs of the element and return them
				if (Browser.attributesOutputInReverseOrder) {
					i = element.attributes.length;
					while (attributeNode = element.attributes[--i]) {
						map.addProperty(attributeNode.nodeName.toLowerCase(), attributeNode.value);
					}
				} else {
					i = -1;
					while (attributeNode = element.attributes[++i]) {
						map.addProperty(attributeNode.nodeName.toLowerCase(), attributeNode.value);
					}
				}
			}
			return map;
		},


		//	Copy attributes from the first element in the jQuery vector to the @target object.
		//	Pass true to @convertValues to use $.convertAttributeValue() to a number or boolean, etc.
		//
		//	Any attributes with underscores will be converted to camelCase, eg:
		//		<div  some-thing="x">	will set the "someThing" property on the object.
		//
		//	Special cases the "class" property to "className".  (IS THIS A GOOD IDEA?)
		//
		//	If you pass a "prefix":
		//		- only properties which start with that prefix will be copied.
		//		- the prefix will be removed from the property name.
		//
		copyAttributesTo : function(target, convertValues, prefix) {
			if (!target) return;
			var attrs = this.attrs();
			for (var key in attrs) {
				var value = attrs[key] || "";
				if (prefix) {
					if (!key.startsWith(prefix)) continue;
					key = key.substr(prefix.length);
				}
				if (convertValues) value = $.convertAttributeValue(value);

				// special case a couple of properties
				if (key === "class") 	key = "className";

				// convert "some-name" to "someName"
				else					key = key.camelize();
				// actually assign
				target[key] = value;
			}
			return this;
		},

		// Remove all css classes that start with some prefix.
		removeClassesStartingWith : function(prefix) {
			this.each(function(index, element) {
				var list = element.className.trim().split(/\s+/g);
				for (var i = list.length-1; i > -1; i--) {
					if (list[i].startsWith(prefix)) list.splice(i, 1);
				}
				list = list.join(" ");
				if (list != element.className) element.className = list;
			});
			return this;
		},

		// Return the inlined css-styles of our first element as a map.
		// Returns null if no style defined on the element.
		styleMap : function() {
			var styleStr = this.attr("style");
//console.info(styleStr);
			if (!styleStr) return null;
//console.warn(styleStr);
			var map = {};
			var STYLE_VALUE_SPLITTER = this.STYLE_VALUE_SPLITTER;
			styleStr.split(this.STYLE_ATTRIBUTE_SPLITTER).forEach(function(style) {
				style = style.trim();
				if (!style) return;
				style = style.split(STYLE_VALUE_SPLITTER);
//console.info(style);
				map[style[0]] = style[1];
			});
			return map;
		},
		STYLE_ATTRIBUTE_SPLITTER : /\s*;\s*/,
		STYLE_VALUE_SPLITTER : /\s*:\s*/
	});


	// given a string value, convert:
	//		- strings that look like numbers to actual numbers
	//		- "true" or "yes" to boolean true
	//		- "false" or "no" to boolean false
	$.NUMBER_PATTERN = /^#([0-9.]+)$/;
	$.convertAttributeValue = function(valueString) {
		var numberMatch = valueString.match($.NUMBER_PATTERN);
		if (numberMatch) {
			return parseFloat(numberMatch[1]);
		} else if (valueString == "true" || valueString == "yes") {
			return true;
		} else if (valueString == "false" || valueString == "no") {
			return false;
		}
		return valueString;
	};



	//
	//	layout
	//
	$.extend($.fn, {
		// syntactic sugar for .offset(), returned as "clientX" and "clientY" for use, eg, with popovers.
		clientOffset : function() {
			var offset = this.offset();
			offset.clientX = offset.left;
			offset.clientY = offset.top;
			return offset;
		},


		// Return the outer size of the first element as `{width:, height:}`.
		//	You can pass margins as `{left:, top:, right:, bottom:}` and we'll inset size by those margins.
		size : function(deltas) {
			var size = {width:this.outerWidth(), height:this.outerHeight()};
			if (deltas) {
				if (deltas.left) 	size.width  -= deltas.left;
				if (deltas.right) 	size.width  -= deltas.right;
				if (deltas.top) 	size.height -= deltas.top;
				if (deltas.bottom) 	size.height -= deltas.bottom;
			}
			return size;
		},


		// Return the rectangle of the first element as {left:, top:, right:, bottom:, width:, height:}
		//	 (NOTE: WITHOUT bottom or right).
		// RELATIVE TO OUR OFFSET PARENT!
		// Includes padding and border if element box sizing is "border-box".
		positionAndSize : function(ignoreRotation) {
			var rect = (ignoreRotation ? this.nonRotatedPosition() : this.position());
			rect.height = this.outerHeight();
			rect.width = this.outerWidth();
			return rect;
		},

		// Return the rectangle of the first element as {left:, top:, right:, bottom:, width:, height:}
		// RELATIVE TO OUR OFFSET PARENT!
		// Includes padding and border if element box sizing is "border-box".
		rect : function(ignoreRotation) {
			var rect = this.positionAndSize(ignoreRotation);
			rect.right = rect.left + rect.width;
			rect.bottom = rect.top + rect.height;
			return rect;
		},

		// Return the rectangle of the first element as {left:, top:, right:, bottom:, width:, height:}
		// RELATIVE TO THE WINDOW!
		// Includes padding and border.
		offsetRect : function() {
			var position = this.offset(),
				height = this.outerHeight()
				width = this.outerWidth()
			;
			return {
				left 	: position.left,
				top	 	: position.top,
				width	: width,
				height	: height,
				right	: position.left + width,
				bottom	: position.top  + height,
			}
		},

		// offset bottom, including margin and padding
		offsetBottom : function() {
			return this.offset().top + this.outerHeight();
		},

		// offset right, including margin and padding
		offsetRight : function() {
			return this.offset().left + this.outerWidth();
		},

		// offset relative to the screen (eg: the window)
		//	note: this subtracts scroll to give you a number relative to the TL corner of the window
		screenOffset : function() {
			var offset = this.offset();
			var $parent = this;
			var $html = $("html"), $body = $("body");

			// NOTE: FF and webkit differ in who's scrolling somtimes when the "body" should be scrolling
			//			so do some special case hacking below to make sure we get data from both.
			while(true) {
				offset.left -= $parent.scrollLeft();
				offset.top  -= $parent.scrollTop();
				if ($parent[0] === $body[0]) {
					$parent = $html;
				} else if ($parent[0] === $html[0]) {
					break;
				} else {
					if ($parent[0] === $parent.offsetParent()[0]) break;
					$parent = $parent.offsetParent();
				}
			}
			return offset;
		},

		// return the margins + padding for the first element
		insets : function(sides) {
			if (!sides) sides = "left right top bottom";
			var insets = {};
			sides.split(" ").forEach(function(side) {
				if (!side) return;
				insets[side] = parseInt(this.css("padding-"+side)) + parseInt(this.css("margin-"+side));
			}, this);
			return insets;
		},


		// Return the maximum WINDOW (offset) rect that contains all elements in the list.
		// If list is empty, returns 0-size rect at 0,0.
		//
		// If you pass `true` to `ignoreRotation`, we'll use `nonRotatedOffsetRect()`
		//	to determine the size of each element, which will ignore rotation effects.
		containingRect : function(ignoreRotation) {
			if (this.length === 0) return {left:0, top:0, width:0, height:0};

			var left=1000000000, top=1000000000, right=-1000000000, bottom=-1000000000;
			var rect;
			this.each(function(index, element) {
				if (ignoreRotation) {
					rect = $(element).nonRotatedOffsetRect();
				} else {
					rect = $(element).offsetRect();
				}
				if (rect.left < left) 		left = rect.left;
				if (rect.top  < top)  		top = rect.top;
				if (rect.right > right)		right = rect.right;
				if (rect.bottom > bottom)	bottom = rect.bottom;
			});
			return {left:left, top:top, width:(right-left), height:(bottom-top)}
		},

		// Return the subset of elements which are intersected by the global rect.
		//	`rect` is specified as {left: top: width: height:}
		// see: http://stackoverflow.com/questions/13390333/two-rectangles-intersection
		intersectedBy : function(rect, ignoreRotation) {
			var left 	= rect.left,
				top 	= rect.top,
				right 	= left + rect.width,
				height	= top + rect.height
			;
			return this.filter(function(index, el) {
				var element = $(el).containingRect(ignoreRotation);
				// false if (X1+W1<X2 or X2+W2<X1 or Y1+H1<Y2 or Y2+H2<Y1):
				return !(   (rect.left + rect.width < element.left)
						 || (element.left + element.width < rect.left)
						 ||	(rect.top + rect.height < element.top)
						 || (element.top + element.height < rect.top)
						);
			});
		},

		// Return the position for the first region WITHOUT ROTATION applied.
		// NOTE: NOT SETTABLE!!!
		nonRotatedPosition : function() {
			var element = this[0];
			var left = 0;
			var top = 0;
			var $parent = $(element.offsetParent);

			if (element) {
				left = (parseInt(element.offsetLeft) || 0) - (parseInt($parent.css("border-left-width")) || 0);
				top  = (parseInt(element.offsetTop) || 0)  - (parseInt($parent.css("border-top-width"))  || 0);
			}
			return {left:left, top:top};
		},

		// Return the offset for the first region WITHOUT ROTATION applied.
		// NOTE: takes scrolling into account!
		// NOTE: NOT SETTABLE!!!
		nonRotatedOffset : function() {
			var left = 0;
			var top = 0;

			var element = this[0];
			if (element) {
				while (element) {
					left += (parseInt(element.offsetLeft) || 0) - (element.scrollLeft || 0);
					top += (parseInt(element.offsetTop) || 0) - (element.scrollTop || 0);
					element = element.parentNode;
				}
			}
			return {left:left, top:top};
		},

		// Return the offset rect for the first region WITHOUT ROTATION applied.
		// NOTE: NOT SETTABLE!!!
		nonRotatedOffsetRect : function() {
			var rect = this.nonRotatedOffset();
			rect.height = this.outerHeight();
			rect.width = this.outerWidth();
			rect.right = rect.left + rect.width;
			rect.bottom = rect.top + rect.height;
			return rect;
		},


		// Convert any rect properties set directly on our elements to relative rects.
		// Defaults to 5 digits of `precision` in the output style.
		relativizeStyleRect : function(parentSize, precision) {
			if (!parentSize) parentSize = this.offsetParent().size();
			if (!precision) precision = 5;
			this.each(function(index, element) {
				var $element = $(element);
				var styleMap = $element.styleMap();
				if (styleMap) {
					Math.relativizeRect(styleMap, parentSize, precision);
					var newStyles = String.getStyleAttributeString(styleMap);
					$element.attr("style", newStyles);
				}
			});
			return this;
		},

		// natural size of an <img> element.  Returns size() if we're not dealing with an image.
		naturalSize : function() {
			if (this.tagName() != "img") return this.size();
			return {
				width : this[0].naturalWidth,
				height: this[0].naturalHeight
			}
		},

		// Return the border sizes of the first element in the vector, as {top, left, bottom, right}
		// NOTE: will probably only work with pixel-sized borders.
		borderSizes : function() {
			return {
				left 	: parseInt(this.css("border-left-width")) || 0,
				top 	: parseInt(this.css("border-top-width")) || 0,
				right 	: parseInt(this.css("border-right-width")) || 0,
				bottom 	: parseInt(this.css("border-bottom-width")) || 0,
			}
		},

		// bring these elements to the front z-index-wise.
		bringToFront : function() {
			if ($.__MAX_Z__ === undefined) $.__MAX_Z__ = 100000;
			var newZ = $.__MAX_Z__++;
			return this.css({"z-index" : newZ});
		},


		// Rectangle of this element which is visible, according to our scrolling.
		// Returns {left, top, width, height, right, bottom}
		scrollRect : function() {
			var rect = {
							left 	: this.scrollLeft(),
							top 	: this.scrollTop(),
							width	: this.innerWidth(),
							height	: this.innerHeight()
						};
			rect.right 	= rect.left + rect.width;
			rect.bottom	= rect.top  + rect.height;
			return rect;
		},

		// Return our rectangle relative to our offsetParent.
		// NOTE: does NOT take scrolling into account!
		// Returns {left, top, width, height, right, bottom}
		relativeRect : function() {
			var element = this[0];
			var rect = {
							left 	: element.offsetLeft,
							top 	: element.offsetTop,
							width	: element.offsetWidth,
							height	: element.offsetHeight
						};
			rect.right 	= rect.left + rect.width;
			rect.bottom	= rect.top  + rect.height;
			return rect;
		},

		// Is (the first) element currently visible AT ALL according to the containing rect?
		// You can pass a scrollRect, or we'll just get our parent's `scrollRect()`
		isVisible : function(containingRect) {
			if (!containingRect) containingRect = this.offsetParent().scrollRect();
			return Math.rectsIntersect(containingRect, this.relativeRect());
		},

		// Intelligently scroll an element into view.
		// We assume that the element's offsetParent() is what will actually scroll.
		//	If some other element is actually what's scrolling, pass it as $parent.
		//
		//	@$parent is the parent element which will actually be scrolled
		//		(defaults to this element's offsetParent()).
		//		To scroll the <body> element, pass "BODY" to work around a nasty bug.
		//
		//	@delta is the amount to of padding on the scroll (default to 20 px)
		//
		//	NOTE: VERTICALLY ONLY
		scrollIntoView : function($parent, delta, skipAnimation) {
			// ignore for empty vectors
			if (this.length === 0) return this;

			if (delta == null) delta = 20;

			var parentTop;
			if (!$parent) {
				$parent = this.offsetParent();
				parentTop = $parent.scrollTop();
			} else if ($parent === "BODY") {
				if (Browser.is.gecko) {
					$parent = $("html");
				} else if (Browser.is.webkit) {
					$parent = $("body");
				} else {
					$parent = $("html,body");
				}
				parentTop = 0;
			}
			var parentBottom = parentTop + $parent.innerHeight(),
				elementTop = this.position().top + parentTop,
				elementBottom = elementTop + this.outerHeight()
			;
//console.warn("eT:", elementTop, "eB:", elementBottom, "pT:", parentTop, "pB", parentBottom, $parent);
			// if element is completely visible, bail
			if (elementTop > parentTop && elementBottom < parentBottom) return;

			// default to showing 20px below the top of the parent
			var newTop = elementTop - delta;

			// special case when the top of the element is visible but not the bottom
			if (elementTop > parentTop && elementTop < parentBottom) {
				newTop = parentTop + (this.outerHeight() + delta);
			}
			// scroll into place with animation.
			if (!skipAnimation) $parent.animate({scrollTop:newTop}, 200, "swing");
			else				$parent.scrollTop(newTop);
		},

		// This method is recursive.
		// This function ensures that an element is visible within it's parent. (and is recursive upward)
		// delta : the offset to give the scroll
		globalScrollIntoView : function(delta) {
			delta = Number(delta) || 0;

			return this.each(function(){

				if (this.tagName.toLowerCase() !== 'html') {
					var $self = $(this);
					var $parent = $self.parent();

					var scroll = $parent.scrollTop();
					var top = $self.position().top;

					top = Math.max(0, top);
					top = top + delta;

					$parent.animate({ scrollTop:top }, 200, "swing");

					top = top - scroll;

					$parent.globalScrollIntoView(top);
				}
			});
		},

		// make sure this item is entirely visible inside its offset container
		ensureFullVisibility : function() {
			// so we don't crowd the edge, if we're adjusting one side or the other we'll offset with this delta
			var delta = 10;
			this.each(function() {
				var $this = $(this);
				var rect = $this.rect();
				var parentSize = $this.parent().size();

				// adjust EITHER left or right (preferring left)
				var left = undefined, top = undefined;
				if (rect.left < 0) 							left = delta;
				else if (rect.right > parentSize.width) 	left = parentSize.width - rect.width - delta;

				// adjust EITHER top or bottom (preferring top)
				if (rect.top < 0) 							top = delta;
				else if (rect.bottom > parentSize.height) 	top = parentSize.height - rect.height - delta;

				if (left === undefined && top === undefined) return;
				var position = {};
				if (left !== undefined) position.left = left;
				if (top !== undefined) 	position.top = top;
				$this.css(position);
			});
			return this;
		},

		// Maximum vertical scroll for an element.
		scrollTopMax : function() {
			var element = this[0];
			if (!element) return 0;
			// use `scrollTopMax` element property if defined (it is in FF at least).
			if (element.scrollTopMax) return element.scrollTopMax;
			return (element.scrollHeight - this.height());
		},

// TODO: move to jquery.align?

		// Center the first element in its container.
		//
		//  Will re-call it self if element or root isn't sized (eg: is hidden) up to 10 times.
		centerInContainer : function(_callbackCount) {
			var $root = this.offsetParent();

			var elementWidth  = this.innerWidth(),
				elementHeight = this.innerHeight(),
				containerWidth  = $root.innerWidth(),
				containerHeight = $root.innerHeight()
			;

			// if width is 0, we're not done drawing yet so call ourselves back
			if (elementWidth == 0 || containerWidth == 0) {
				// if we've called back 10 times and width is still not defined,
				//	something is wrong so forget it
				if (!_callbackCount) _callbackCount == 0;
				if (++_callbackCount > 10) return;
				setTimeout(this.centerInContainer.bind(this, arguments), 100);
				return;
			}

			var left = Math.floor((containerWidth - elementWidth) / 2),
				top  = Math.floor((containerHeight - elementHeight) / 2)
			;
			this.css({
				left : left,
				top : top
			});
		},

// TODO: move to jquery.align?

		// Expand us to explicitly fit the entire size of our offsetParent.
		//	NOTE: assumes this element is position:absolute or fixed!
		//
		//  Will re-call it self if root isn't sized (eg: is hidden) up to 10 times.
		fitToContainer : function(_callbackCount) {
			var $root = this.offsetParent();

			var containerWidth  = $root.innerWidth(),
				containerHeight = $root.innerHeight()
			;

			// if width is 0, we're not done drawing yet so call ourselves back
			if (containerWidth == 0) {
				// if we've called back 10 times and width is still not defined,
				//	something is wrong so forget it
				if (!_callbackCount) _callbackCount == 0;
				if (++_callbackCount > 10) return;
				setTimeout(this.fitToContainer.bind(this, arguments), 100);
				return;
			}

			this.css({
				left : 0,
				top : 0,
				width : containerWidth,
				height : containerHeight
			});
		},

		// Shrink font-size of an element until the height of its children is <= its outer height.
		// NOTE: not well defined for things with many child elements.
		//
		// Pass `true` to `removeInlineStyleFirst` to clear an explicit font-size
		//	set directly on the element (not through a stylesheet) first before shrinking.
		//	This is a good idea if, eg, you've run `shrinkTextToFit()` on an element previously
		//	so it might already be smaller than it needs to be.
		//
		// Default `minimumSize` is 6px (arbitrary).
		shrinkTextToFit : function(removeInlineStyleFirst, minimumSize) {
			if (typeof minimumSize !== "number") minimumSize = 6;
			var i = -1, element;
			while ((element = this[++i])) {
				var $element = $(element);

				// remove the inline font-size style first if desired
				if (removeInlineStyleFirst) $element.css("font-size", "");

				var $children = $element.children();
				var size = parseInt($element.css("font-size"));
				while (size > minimumSize && ($children.outerHeight() > $element.innerHeight())) {
					$element.css("font-size", --size);
				}
			}
			return this;
		}
	});


	//
	//	Move to back/front etc by re-arranging elements within their parent().
	//
	//	NOTE: these will clear z-index set on the elements in question,
	//			if we don't do this, z-index will trump element order.
	//
	$.extend($.fn, {
		moveToBack : function() {
			this.css("z-index", "auto");
			this.parent().prepend(this);
		},

		//
		moveBack : function() {
			this.css("z-index", "auto");
			this.prev().before(this);
		},

		moveForward : function() {
			this.css("z-index", "auto");
			this.next().after(this);
		},

		moveToFront : function() {
			this.css("z-index", "auto");
			this.parent().append(this);
		},
	});


	//
	// if we're on mobile, avoid generating touchend events if we scroll when the finger is down
	//
	if (Browser.mobile) {
		var _touchMoved = false;
		function touchMoved(event) {
			event = $.event.fix(event);
			_touchMoved = true;
		}
		function touchEnd(event) {
			event = $.event.fix(event);
			if (event.targetTouches.length != 0) return;
			if (_touchMoved) {
		//		alert("MOVED");
				event.preventDefault();
				event.stopPropagation();
			} else {
		//		alert("NO MOVE");
			}
			_touchMoved = false;
		}
		$("body").captureEvent("touchmove", touchMoved);
		$("body").captureEvent("touchend", touchEnd);
	}

	return $;
});	// end define("oak/lib/jquery/jquery.extensions")
