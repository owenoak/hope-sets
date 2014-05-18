/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//  Canvas extensions.
//
Module.define("oak/lib/browser/CanvasHelper", "oak/lib/core/Singleton", function(Singleton) {
	new Singleton("CanvasHelper", {
		// Given a `rect` (or at least an object with some of left, top, width, etc properties)
		//	and a fractional `scale`, return a new object with the scaled coordinates.
		// Pass `true` to `returnIntegers` to do a Math.floor() on the resulting values.
		scaleRect : function(rect, scale, returnIntegers) {
			var scaled = {};
			for (var key in rect) {
				scaled[key] = rect[key] * scale;
				if (returnIntegers) scaled[key] = Math.floor(scaled[key]);
			}
			return scaled;
		},

		// Return the rendered size of a canvas.
		getSize : function(canvas) {
			return { 	width: parseInt($(canvas).attr("width")),
						height : parseInt($(canvas).attr("height"))
					};
		},

		// Resize a `sourceCanvas` into a new canvas according to the `targetScale` (float).
		//	By default if we're resizing down, we resize in steps to get the highest quality end result,
		//	pass `true` to `quick` to do it in one go.
		rescale : function(sourceCanvas, targetScale, quick) {
			var scaler = (quick ? CanvasHelper.resize : CanvasHelper.bilinearResize);

			var sourceSize = CanvasHelper.getSize(sourceCanvas);
			// console.group("rescale(",sourceSize,",",targetScale,",",quick,")");
			var resizedCanvas, targetSize;

			// if we're resizing up, we're going down by half exactly, or quick is true, just do it in one go
			if (targetScale >= 1 || targetScale == 1/2 || quick) {
				targetSize = CanvasHelper.scaleRect(sourceSize, targetScale, true);
				// console.info("resizing in one go to: ",targetSize);
			} else {
				// resizing down -- do it in steps
				// first jump down to twice the destination size
				targetSize = CanvasHelper.scaleRect(sourceSize, targetScale*2, true);
				// console.info("resizing in steps, first to: ",targetSize);
				resizedCanvas = scaler(sourceCanvas, targetSize);

				// now go to exact size
				targetSize = CanvasHelper.scaleRect(sourceSize, targetScale, true);
				// console.info("resizing in steps, finally to: ",targetSize);
			}
			resizedCanvas = scaler(sourceCanvas, targetSize);
			// console.groupEnd();
			return resizedCanvas;
		},

		// Return a copy of canvas in the new targetSize.
		// NOTE: this always goes in one jump, and may not respect the original aspect ratio.
		resize : function(sourceCanvas, targetSize) {
			// make sure at least one of width and/or height was specified.
			if (!targetSize || (!targetSize.width && !targetSize.height)) {
				console.error("CanvasHelper.resize(",arguments,"): invalid target size");
				return null;
			}

			// if targetSize.width isn't defined, make it a function of the height
			var sourceSize = this.getSize(sourceCanvas);
			if (!targetSize.width) {
				targetSize.height = Math.floor(sourceSize.height * (targetSize.width/sourceSize.width));
			}
			// if targetSize.height isn't defined, make it a function of the width
			if (!targetSize.height) {
				targetSize.width = Math.floor(sourceSize.width * (targetSize.height/sourceSize.height));
			}

			var targetCanvas = $("<canvas width='"+targetSize.width+"' height='"+targetSize.height+"'></canvas>")[0];
			var targetContext = targetCanvas.getContext("2d");
			targetContext.drawImage(sourceCanvas, 0, 0, targetSize.width, targetSize.height);
			return targetCanvas;
		},

		// Bilinear scale of a canvas to some absolute size of its current size (up or down).
		// NOTE: assumes that we're scaling to the same aspect ratio as the sourceCanvas!
		//
		// `newSize` is an object with `width` and/or `height`.
		//	If both are provided, we'll figure out the scale with width, otherwise we'll use height.
		//
		// see `bilinearScale()`
		bilinearResize : function(sourceCanvas, newSize) {
			var sourceSize = CanvasHelper.getSize(sourceCanvas);
			var scale = (newSize.width ? (newSize.width / sourceSize.width) : (newSize.height / sourceSize.height));
			return CanvasHelper.bilinearScale(sourceCanvas, scale);
		},

		// Bilinear scale of a canvas to some fraction of its current size (up or down).
		// based on:  http://www.strauss-acoustics.ch/js-bilinear-interpolation.html
		bilinearScale : function(sourceCanvas, scale) {
			var sourceSize = CanvasHelper.getSize(sourceCanvas);
			var sourceData = sourceCanvas.getContext("2d").getImageData(0, 0, sourceSize.width, sourceSize.height).data;

			var targetSize = CanvasHelper.scaleRect(sourceSize, scale, true);
			var targetCanvas = $("<canvas width='"+targetSize.width+"' height='"+targetSize.height+"'></canvas>")[0];
			var targetData = targetCanvas.getContext("2d").createImageData(targetSize.width, targetSize.height);

			var srcWidth = sourceSize.width;
			var srcMaxWidth = (srcWidth - 1);
			var srcMaxHeight = (sourceSize.height - 1);

			var destWidth = targetSize.width;
			var destHeight = targetSize.height;

			var i, j;
			var iyv, iy0, iy1, ixv, ix0, ix1;
			var idxD, idxS00, idxS10, idxS01, idxS11;
			var dx, dy, un_x, un_y;
			var f00, f10, f01, f11;
			var r, g, b, a;
			for (i = 0; i < destHeight; ++i) {
				iyv = (i + 0.5) / scale - 0.5;
				iy0 = Math.floor(iyv);
				// Math.ceil can go over bounds
				iy1 = Math.ceil(iyv);
				if (iy1 > srcMaxHeight) iy1 = srcMaxHeight;

				for (j = 0; j < destWidth; ++j) {
					ixv = (j + 0.5) / scale - 0.5;
					ix0 = Math.floor(ixv);
					// Math.ceil can go over bounds
					ix1 = Math.ceil(ixv);
					if (ix1 > srcMaxWidth) ix1 = srcMaxWidth;
					idxD = ((j + destWidth * i) * 4);

					// matrix to vector indices
					idxS00 = ((ix0 + srcWidth * iy0) * 4);
					idxS10 = ((ix1 + srcWidth * iy0) * 4);
					idxS01 = ((ix0 + srcWidth * iy1) * 4);
					idxS11 = ((ix1 + srcWidth * iy1) * 4);

					// overall coordinates to unit square
					dx = ixv - ix0; dy = iyv - iy0;
					un_x = 1.0 - dx; un_y = 1.0 - dy;

					// red channel
					f00 = sourceData[idxS00]; f10 = sourceData[idxS10];
					f01 = sourceData[idxS01]; f11 = sourceData[idxS11];
					targetData.data[idxD] = (f00 * un_x * un_y + f10 * dx * un_y + f01 * un_x * dy + f11 * dx * dy);

					// green channel
					f00 = sourceData[idxS00+1]; f10 = sourceData[idxS10+1];
					f01 = sourceData[idxS01+1]; f11 = sourceData[idxS11+1];
					targetData.data[idxD+1] = (f00 * un_x * un_y + f10 * dx * un_y + f01 * un_x * dy + f11 * dx * dy);

					// blue channel
					f00 = sourceData[idxS00+2]; f10 = sourceData[idxS10+2];
					f01 = sourceData[idxS01+2]; f11 = sourceData[idxS11+2];
					targetData.data[idxD+2] = (f00 * un_x * un_y + f10 * dx * un_y + f01 * un_x * dy + f11 * dx * dy);

					// alpha channel
					f00 = sourceData[idxS00+3]; f10 = sourceData[idxS10+3];
					f01 = sourceData[idxS01+3]; f11 = sourceData[idxS11+3];
					targetData.data[idxD+3] = (f00 * un_x * un_y + f10 * dx * un_y + f01 * un_x * dy + f11 * dx * dy);
				}
			}

			targetCanvas.getContext("2d").putImageData(targetData, 0, 0);
			return targetCanvas;
		},

		// Routines to draw shadows for front/back/spread pages.
		// NOTE: called anonymously!
		getPageShadowRenderer : function(type) {
			if (type === "front") 	return this.renderFrontShadow;
			if (type === "back") 	return this.renderBackShadow;
			return this.renderSpreadShadow;
		},
		// Draw a "front cover page" shadow on top of a canvas.
		renderFrontShadow : function(canvas, shadowWidth, lightColor, darkColor) {
			var canvasSize = CanvasHelper.getSize(canvas);
			var context = canvas.getContext("2d");
			var startX = 0;
			var endX = shadowWidth;
			var shadowGradient = context.createLinearGradient(startX, 0, endX, 0);
			shadowGradient.addColorStop(1, lightColor);
			shadowGradient.addColorStop(0, darkColor);
			context.fillStyle = shadowGradient;
			context.fillRect(startX, 0, endX, canvasSize.height);
		},

		// Draw a "back cover page" shadow on top of a canvas.
		renderBackShadow : function(canvas, shadowWidth, lightColor, darkColor) {
			var canvasSize = CanvasHelper.getSize(canvas);
			var context = canvas.getContext("2d");
			var startX = (canvasSize.width - shadowWidth);
			var endX = canvasSize.width;
			var shadowGradient = context.createLinearGradient(startX, 0, endX, 0);
			shadowGradient.addColorStop(1, darkColor);
			shadowGradient.addColorStop(0, lightColor);
			context.fillStyle = shadowGradient;
			context.fillRect(startX, 0, endX, canvasSize.height);
		},

		// Draw a "2-page spread" shadow on top of a canvas.
		renderSpreadShadow : function(canvas, shadowWidth, lightColor, darkColor) {
			var canvasSize = CanvasHelper.getSize(canvas);
			var context = canvas.getContext("2d");
			var centerX = (canvasSize.width / 2);
			var startX = (centerX - shadowWidth);
			var endX = (centerX + shadowWidth);
			var shadowGradient = context.createLinearGradient(startX, 0, endX, 0);
			shadowGradient.addColorStop(0, lightColor);
			shadowGradient.addColorStop(.5, darkColor);
			shadowGradient.addColorStop(1, lightColor);
			context.fillStyle = shadowGradient;
			context.fillRect(startX, 0, endX, canvasSize.height);
		},



	});	// end new Singleton("CanvasHelper")
	return CanvasHelper;
});	// end define("oak/lib/browser/CanvasHelper")
