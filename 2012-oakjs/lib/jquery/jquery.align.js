/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

/*
	Add methods to perform aligment/moving/etc on a number of objects at once.
	After inclusion, you can call these methods on any jQuery object.
 */


Module.define("oak/lib/jquery/jquery.align",
"oak/lib/js/Math,oak/lib/jquery/jquery.extensions",
function(Math, jqueryPado) {

	// used for truthyness evaluation in .some() etc below
	function areTruthy(value){ return !!value }

	$.extend($.fn, {

		// Nudge all elements a certain `amount` in the specified `direction`.
		nudge : function(direction, amount) {
			if (!direction) {
				console.warn(this,".nudge(): direction not specified!  bailing");
				return this;
			}
			if (amount == null) amount = 1;

			this.each(function(index, element) {
				var $element = $(element);
				var position = $element.nonRotatedPosition();
				if (direction === "left")			position.left -= amount;
				else if (direction === "right")		position.left += amount;
				else if (direction === "up")		position.top  -= amount;
				else if (direction === "down")		position.top  += amount;
				$element.css(position);
			});
			return this;
		},


		// Align top edge of all selected regions with the `globalTop` passed in.
		alignTops : function(globalTop) {
			if (!globalTop) globalTop = 0;
			this.each(function(index, element) {
				var $element = $(element);
				var delta = $element.nonRotatedOffset().top - globalTop;
				var newTop = Math.floor($element.position().top - delta);
				$element.css("top", newTop);
			});
			return this;
		},

		// Align vertical centers of all selected regions with the `globalCenter` passed in.
		alignVerticalCenters : function(globalCenter) {
			if (!globalCenter) globalCenter = 0;
			this.each(function(index, element) {
				var $element = $(element);
				var delta = ($element.nonRotatedOffset().top + ($element.outerHeight()/2)) - globalCenter;
				var newCenter = Math.ceil($element.position().top - delta);
				$element.css("top", newCenter);
			});
			return this;
		},

		// Align bottom edge of all selected regions with the `globalBottom` passed in.
		alignBottoms : function(globalBottom) {
			if (!globalBottom) globalBottom = 0;
			this.each(function(index, element) {
				var $element = $(element);
				var delta = ($element.nonRotatedOffset().top + $element.outerHeight()) - globalBottom;
				var newBottom = Math.ceil($element.position().top - delta);
				$element.css("top", newBottom);
			});
			return this;
		},

		// Align left edge of all selected regions with the `globalLeft` passed in.
		alignLefts : function(globalLeft) {
			if (!globalLeft) globalLeft = 0;
			this.each(function(index, element) {
				var $element = $(element);
				var delta = $element.nonRotatedOffset().left - globalLeft;
				var newLeft = Math.floor($element.position().left - delta);
				$element.css("left", newLeft);
			});
			return this;
		},

		// Align horizontal centers of all selected regions with the `globalCenter` passed in.
		alignHorizontalCenters : function(globalCenter) {
			if (!globalCenter) globalCenter = 0;
			this.each(function(index, element) {
				var $element = $(element);
				var delta = ($element.nonRotatedOffset().left + ($element.outerWidth()/2)) - globalCenter;
				var newCenter = Math.ceil($element.position().left - delta);
				$element.css("left", newCenter);
			});
			return this;
		},

		// Align right edge of all selected regions with the `globalRight` passed in.
		alignRights : function(globalRight) {
			if (!globalRight) globalRight = 0;
			this.each(function(index, element) {
				var $element = $(element);
				var delta = ($element.nonRotatedOffset().left + $element.outerWidth()) - globalRight;
				var newRight = Math.ceil($element.position().left - delta);
				$element.css("left", newRight);
			});
			return this;
		},


		// Distribute a bunch of items horizontally.
		// NOTE: we do this so there's an even amount of space in between each element, no matter their original width.
		distributeHorizontally : function(globalLeft, globalRight) {
			if (this.length < 3) return this;

			// sort elements by their left
			var $elements = this.sortByOffset();

			// figure out the total space for all of the items
			var availableWidth = (globalRight - globalLeft);
			var widths = [], usedWidth = 0;
			$elements.each(function(index, element) {
				var width = $(element).outerWidth();	// TODO: rotation???
				widths.append(width);
				usedWidth += width;
			});

			// margin between each element
			var margin = (availableWidth - usedWidth) / ($elements.length-1);

			// leave left-most and right-most elements in place!
			var localLeft = $($elements[0]).position().left;
			for (var i = 1; i < $elements.length - 1; i++) {
				localLeft += widths[i-1] + margin;
				$($elements[i]).css("left", Math.round(localLeft));
			}
		},


		// Distribute a bunch of items vertically.
		// NOTE: we do this so there's an even amount of space in between each element, no matter their original width.
		distributeVertically : function(globalTop, globalBottom) {
			if (this.length < 3) return this;

			// sort elements by their tops
			var $elements = this.sortByOffset();

			// figure out the total space for all of the items
			var availableHeight = (globalBottom - globalTop);
			var heights = [], usedHeight = 0;
			$elements.each(function(index, element) {
				var height = $(element).outerHeight();	// TODO: rotation???
				heights.append(height);
				usedHeight += height;
			});

			// margin between each element
			var margin = (availableHeight - usedHeight) / ($elements.length-1);

			// leave top-most and bottom-most elements in place!
			var localTop = $($elements[0]).position().top;
			for (var i = 1; i < $elements.length - 1; i++) {
				localTop += heights[i-1] + margin;
				$($elements[i]).css("top", Math.round(localTop));
			}
		},


		// Space apart a bunch of items horizontally, putting `margin` pixels between.
		spaceHorizontally : function(margin) {
			if (this.length < 2) return this;

			// sort elements by their left
			var $elements = this.sortByOffset();

			// leave left-most element in place!
			var localLeft = $($elements[0]).position().left;
			for (var i = 1; i < $elements.length; i++) {
				localLeft += $($elements[i-1]).outerWidth() + margin;
				$($elements[i]).css("left", Math.round(localLeft));
			}
		},

		// Space apart a bunch of items horizontally, putting `margin` pixels between.
		spaceVertically : function(margin) {
			if (this.length < 2) return this;

			// sort elements by their top
			var $elements = this.sortByOffset();

			// leave top-most element in place!
			var localTop = $($elements[0]).position().top;
			for (var i = 1; i < $elements.length; i++) {
				localTop += $($elements[i-1]).outerHeight() + margin;
				$($elements[i]).css("top", Math.round(localTop));
			}
		},


		// Return a copy of this vector with the elements sorted according to their "natural" order:
		//		by left then by top.
		sortByOffset : function() {
			var items = [];
			this.each(function(index, element) {
				var offset = $(element).nonRotatedOffset();
				items.append({left:offset.left, left:offset.left, element:element});
			});
			items.sort(function(a,b) {
				if (a.left < b.left) return -1;
				if (a.left > b.left) return 1;
				if (a.top < b.top) return -1;
				if (a.top > b.top) return 1;
				return 0;
			});
			return $(items.map(function(it){return it.element}));
		},

	});


	return $;
});	// end define("oak/lib/jquery/jquery.align")
