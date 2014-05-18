/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Math extensions
//
Module.define("oak/lib/js/Math",
	"oak/lib/js/Object,oak/lib/js/Number",
	function(Object, Number)
{

	var RECT_HORIZONTAL_PROPERTIES = "left,width,right".split(",");
	var RECT_VERTICAL_PROPERTIES = "top,height,bottom".split(",");
	Property.patch(Math, {
		// Given a `rectMap`, normalize the rectangle into integer coordinates.
		// 	- LEFT and TOP will use 	`Math.floor()`
		//	- RIGHT and BOTTOM will use	`Math.ceil()`
		//	- WIDTH and HEIGHT will use	`Math.ceil()`
		//
		// NOTE:  this CHANGES the original rect!
		integerRect : function(map) {
			if (!map) return map;
			if (map.left)   map.left   = Math.floor(map.left);
			if (map.top)    map.top    = Math.floor(map.top);
			if (map.width)  map.width  = Math.ceil(map.width);
			if (map.height) map.height = Math.ceil(map.height);
			if (map.right)  map.right  = Math.ceil(map.right);
			if (map.bottom) map.bottom = Math.ceil(map.bottom);
			return map;
		},


		// Given a `rectMap` (whose values are strings, may be percentages or absolute values)
		//	convert any of the "left,top,width,height,right,bottom" properties in the rectMap into percentages.
		//  Ignores any non-rect properties.
		//  If you pass a number for precision, we'll return a string with that many digits (eg:  "3.021%")
		//	If you omit it, we'll return floating point numbers.
		relativizeRect : function(rectMap, parentSize, precision) {
			RECT_HORIZONTAL_PROPERTIES.forEach(function(key) {
				var value = Math.stringToPercentage(rectMap[key], parentSize.width, precision);
				if (value !== null) rectMap[key] = value;
			});
			RECT_VERTICAL_PROPERTIES.forEach(function(key) {
				var value = Math.stringToPercentage(rectMap[key], parentSize.height, precision);
				if (value !== null) rectMap[key] = value;
			});
		},

		// Given a value string as either a whole number ("35") or a percentage ("0.35%")
		//	and a corresponding `parentSize` (a number, eg: 100), return the value as a percentage of the parent size
		//	as a string ("0.35%").
		//  If you pass in null or an invalid string, returns null.
		//  Defaults to 5 digit precision.
		stringToPercentage : function(value, parentSize, precision) {
			if (value == null) return null;
			if (typeof value === "string") {
				// if already a percentage, forget it
				if (value.contains("%")) return value;
				value = parseInt(value);
				if (isNaN(value)) return null;
			}
			if (!precision) precision = 5;
			return ((value / parentSize) * 100).precision(precision) + "%";
		},

		// Given an `imageSize`, a `frameSize` and a sizing `fitStyle`,
		//	return the desired size for the image, maintaining image aspect ratio.
		//
		//	NOTE: we'll return a NEW object containing {left:, top:, width:, height:} for the image.
		//
		// fitStyle is one of:
		//	- "fit"			: make the entire image fit within the frame
		//	- "fill-width"	: set image width to frame width and center/crop vertically
		//	- "fill-height"	: set image height to frame height and center/crop horizontally
		//	- "fill-both"	: make the image fill the frame completely (may crop on either side)
		//
		// You can specify a `outputPercent` (int from 0-100), we'll scale the image by that amount SMALLER than the frame.
		//	Default is 100% (full size of the frame).
		//	Do this by appending ":<size>" to the `fitStyle`, eg:  "fit:120" == fit at 120% of image size
		//
		// You can also specify an "anchor" for the image, as "N", "NW", "E", "SE", etc.
		//	Do this by appending ":<size>:<anchor>" to the `fitStyle`, eg:  "fit:100:NW" == fit at 100% of image size, anchor to the top-left
		sizeImageInFrame : function(imageSize, frameSize, fitStyle) {
			var outputPercent = 100, anchor = "NW";
			if (fitStyle.contains(":")) {
				var split = fitStyle.split(":");
				fitStyle = split[0];
				outputPercent = parseInt(split[1]) || 100;
				anchor = (split[2] || "NW").toUpperCase();
			}

			// adjust the frame size according to the output percent
			var	adjustedFrameSize = {
				width  : Math.floor(frameSize.width * (outputPercent / 100)),
				height : Math.floor(frameSize.height * (outputPercent / 100)),
			};

			// if we have a frameSize, but not an imageSize
			//	just use the frameSize to calculate the size and hope for the best
			if (frameSize && !imageSize) {
				var results = {};
				// if fill-height, return the height of the frame
				if (fitStyle === "fill-height") {
					results.height = adjustedFrameSize.height;
				}
				// otherwise return the width of the frame
				else {
					results.width = adjustedFrameSize.width;
				}
// TODO: anchor ???
				return results;
			}

			var width = imageSize.width,
				height = imageSize.height,
				imageRatio = width/height,
				delta;

			// fill width and center or crop top
			if (fitStyle == "fill-width") {
				width = adjustedFrameSize.width;
				height = Math.floor(adjustedFrameSize.width / imageRatio);
			}
			// fill height and center or crop left
			else if (fitStyle == "fill-height") {
				height = adjustedFrameSize.height;
				width = Math.floor(imageRatio * adjustedFrameSize.height);
			}
			// fully fill frame and crop left and/or top as necessary
			else if (fitStyle == "fill-both") {
				// assume full width
				width = adjustedFrameSize.width;
				height = Math.floor(adjustedFrameSize.width / imageRatio);
				if (height < adjustedFrameSize.height) {
					height = adjustedFrameSize.height;
					width = Math.floor(imageRatio * adjustedFrameSize.height);
				}
			}
			// fit completely within the frame, centering as necessary
			else if (fitStyle == "fit") {
				// assume full width
				width = adjustedFrameSize.width;
				height = Math.floor(adjustedFrameSize.width / imageRatio);
				if (height > adjustedFrameSize.height) {
					delta = adjustedFrameSize.height / height;
					width = Math.floor(width * delta);
					height = Math.floor(height * delta);
				}
			}

			var results = {
				width  : width,
				height : height
			};

			// set left/top according to "anchor"
			var heightDelta = (frameSize.height - height);
			if (anchor.contains("N")) {
				results.top = 0;
			} else if (anchor.contains("S")) {
				results.top = Math.floor(heightDelta);
			} else {
				results.top = Math.floor(heightDelta/2);
			}

			var widthDelta = (frameSize.width - width);
			if (anchor.contains("W")) {
				results.left = 0;
			} else if (anchor.contains("E")) {
				results.left = Math.floor(widthDelta);
			} else {
				results.left = Math.floor(widthDelta/2);
			}
//console.warn(anchor, heightDelta, widthDelta);
//console.dir(results);
			return results;
		},


		// Return true if the rect {left, top, width, height} contains the point {left, top}.
		// NOTE: assumes rect & point have all the variables above.
		// NOTE: assumes they are both in the same coordinate system!
		rectContainsPoint : function(rect, point) {
				return 	   point.left >= rect.left
						&& point.left <= (rect.left + rect.width)
						&& point.top  >= rect.top
						&& point.top  <= (rect.top + rect.height);

		},

		// Return true if two rects intersect AT ALL.
		// Assumes rects have {left, top, width, height}.
		rectsIntersect : function(rect1, rect2) {
			// from:  http://stackoverflow.com/questions/13390333/two-rectangles-intersection
			// (X1 + W1 < X2) || (X2 + W2 < X1) || (Y1 + H1 < Y2) || (Y2 + H2 < Y1)
			var intersects = ! (   (rect1.left + rect1.width < rect2.left)
								|| (rect2.left + rect2.width < rect1.left)
								|| (rect1.top + rect1.height < rect2.top)
								|| (rect2.top + rect2.height < rect1.top)
							   );
//console.debug("rectsIntersect", rect1, rect2, intersects);
			return intersects;
		},

	//
	//	color stuff
	//
		HEX_COLOR_PATTERN : Property.Constant(/^\s*#?([A-F0-9]{3}|[A-F0-9]{6})\s*$/i),
		// Return a (possibly massaged) color string if the one passed in is valid.
		// Returns `undefined` if invalid.
		validateColor : function(colorString) {
			if (typeof colorString === "string") {
				var match = colorString.trim().toUpperCase().match(Math.HEX_COLOR_PATTERN);
				if (match) return "#"+match[1];
			}
			return undefined;
		}
	});

	return Math;
});	// end define("oak/lib/js/Math")
