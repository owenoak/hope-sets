/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//  Browser zoom detection
//
//	Events emitted:
//		"zoomed" - data object contains single property `zoom` with new zoom factor.
//
Module.define("oak/lib/browser/Zoom",
["oak/lib/core/Singleton","oak/lib/browser/Stylesheet"],
function(Singleton, Stylesheet) {

	new Singleton("Zoom", {
		// The current known browser window zoom level.
		currentZoom : 0,

		init : function() {
			// Setup listener on the window to know if the zoom level changed.
			// Collapse multiple resizes, as the browser can fire them fast and furious.
			$(window).on('resize', this.bindSoon("_refresh", 0.05));
			this._refresh();
		},

		// refresh the known browser zoom level
		_refresh : function() {
			if (Browser.is.ie) {
				debugger;
				// TODO: add ie support from detect-zoom.js
			}
			// With Safari, we have to poll window outer/inner width to wait for it to stop
			// changing before we can rely on the numbers for the zoom calculation.
			else if (Browser.is.safari) {
				this._pollInnerOuterWidth();
			}
			// other browsers with devicePixelRatio work properly
			else if (window.devicePixelRatio) {
				this._onZoomCalculated(window.devicePixelRatio);
			}
			//
			else {
				console.warn("Don't know how to calculate zoom for this browser.");
			}
		},

		// In Safari, we the ratio between window's inner and outer width is our zoom level.
		// We'll poll to see when this changes.
		//
		// NOTE: on some browsers, the value is unstable for a little while during resize,
		//		 so we'll make sure the ratio stays constant for 30 msec before
		//		 we report the actual change.
		ZOOM_POLL_COUNT : 3,
		_pollInnerOuterWidth : function() {
			var self = this;
			var startZoomRatio = window.outerWidth/window.innerWidth;
			var matchCount = 0;

			clearInterval(self._pollingInterval);
			self._pollingInterval = setInterval(function() {
				var currentZoomRatio = window.outerWidth/window.innerWidth;
				// console.log("inner/outer: "+currentZoomRatio+" ("+matchCount+")");

				// if current is same as start value
				if (currentZoomRatio === startZoomRatio) {
					matchCount++;
					if (matchCount >= self.ZOOM_POLL_COUNT) {
						clearInterval(self._pollingInterval);
						self._onZoomCalculated(currentZoomRatio);
					}
				}
				// reset match count so we'll do another 3 more tries
				else {
					matchCount = 0;
				}
				startZoomRatio = currentZoomRatio;
			}, 10);
		},

		// Handle a new zoom value calculated.
		// Will trigger an external `"zoomed"` event if `newZoom` is different than our `currentZoom`.
		_onZoomCalculated : function(newZoom) {
			// round to 2 significant digits
			newZoom = newZoom.precision(2);

			if (newZoom != this.currentZoom) {
				this.currentZoom = newZoom;
				this._updateZoomCss(newZoom);
				// console.log('new zoom level '+newZoom);
				$(this).trigger("zoomed", newZoom);
			}
		},

		// Update css styles "dontZoom" and "zoom" to match the current zoom level.
		_updateZoomCss : function(zoom) {
			var stylesheet = Stylesheet.get('widget');
			if (!stylesheet) return;
			var dontZoomRule = stylesheet.getRule('.dontzoom');
			var zoomRule = stylesheet.getRule('.zoom');
			if (!dontZoomRule) return;

			// gecko doesn't support the "zoom" css settings
			if (Browser.is.gecko) {
				dontZoomRule.style.transform = "scale("+(1/zoom)+")";
				zoomRule.style.transform = "scale("+zoom+")";
//				dontZoomRule.style.width = (zoom*100)+"%";
//				zoomRule.style.width = ((1/zoom)*100)+"%";
			} else {
				dontZoomRule.style.zoom = 1/zoom;
				zoomRule.style.zoom = zoom;
			}
		},

	});	// end new Singleton("Zoom")
	return Zoom;
});	// end define("oak/lib/browser/Zoom")
