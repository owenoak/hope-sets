/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
// Queue to manage rendering of bits.
//
//	You must override "renderItem", which should return a promise, to be resolved with the url of the thing that was rendered.
//
Module.define("oak/lib/core/RenderQueue",
"oak/lib/core/IndexedList,oak/lib/core/Soonable",
function(IndexedList, Soonable) {

	// Load the `html2canvas` class, but don't wait for it.
	Module.require("//cdnjs.cloudflare.com/ajax/libs/html2canvas/0.4.1/html2canvas.js");

	var RenderQueue = new Class("RenderQueue", {
		mixins : "Soonable",

		// Key property for our items.
		// You can set this or override "getKeyForItem()" to do something more exotic.
		keyProperty : "key",

		// Scope for render callbacks.
		// If undefined, the scope will be the queue itself.
		scope : undefined,

		// Delay IN SECONDS between when something is added to the queue and when we actually render.
		// 0 = virtually no delay between renders.  (This can, eg, overwhelm your server, so caveat emptor).
		delay : 0,

		// Set to the CSS class of a loading image to be displayed while we're updating the thumbnail.
		loadingClass : undefined,

		// Callback to actually render a single item.
		// Return a promise to be resolved with the url of the rendered thing if rendering works.
		renderNow : function(item) {
			throw this+".renderNow() must be overridden!";
		},

		// Given an item, return the key for it.
		// Default is to simply return `item[this.keyProperty]`, but if you can, eg,
		//	translate a string into an item, you may want to override.
		getKeyForItem : function(item) {
			return (item ? item[this.keyProperty] : undefined);
		},


	//
	//	initialization
	//

		// Our actual queue, as an IndexedList
		_queue : undefined,

		// Current item being rendered.
		_current : undefined,


		// initializer
		init : function(properties) {
			this.asThing("init");

			// NOTE: the key property for the queue is ALWAYS "key",
			//		 as it refers to the wrapper, not the item itself.
			this._queue = new IndexedList("key");

			// default scope
			if (!this.scope) this.scope = this;
		},

		// On destroy, cancel all subsequent renders.
		destroy : function() {
			this.clear();
		},

	//
	//	adding/removing from the list
	//


		// Add an item to our queue.
		// Returns a promise resolved with the render url when the render completes,
		// or rejected if render is cancelled.
		//
		// You can also pass and $image, which will be automatically updated when render completes.
		add : function(item, $image) {
			var key = this.getKeyForItem(item);
			if (key == null) {
				console.warn("renderQueue.add(",item,"): key property '"+this.keyProperty+"' is null!");
				return $.Deferred().reject();
			}

			// if it's not in the list already...
			var wrapper = this._queue.MAP[key];
			// create a wrapper and add it to the end
			if (!wrapper) {
				wrapper = {
					item 	: item,
					key		: key,
					promise	: $.Deferred()
				};
				this._queue.add(wrapper);
			}

			// if we have an image, add a handler to update the image when the promise resolves
			if ($image && $image.jquery && $image.length) {
				// apply loading class to the image, undoing after promise resolves
				var loadingClass = this.loadingClass;
				if (loadingClass) {
					$image.addClass(loadingClass);
					wrapper.promise.always(function(){$image.removeClass(loadingClass);});
				}
				// and update the image's src if it completed successfully
				wrapper.promise.done(function(url) {
					if (typeof url !== "string") return;
					// add a timestamp to the url to force the browser to redraw it
					url = url.addQueryParam("___", Date.now());
					$image.attr("src", url);
				});

				// clear the current src
				$image.attr("src", "");
			}
			// if no $image, we still want to load the new image after creating it
			//	or some browsers will continue to use an old version of the image
			else {
				wrapper.promise.done(function(url) {
					if (typeof url !== "string") return;
					// add a timestamp to the url to force the browser to redraw it
					url = url.addQueryParam("___", Date.now());
					(new Image()).src = url;
				});
			}

			// check the next item in the queue "soon"
			this.checkQueueSoon();

			// return the promise
			return wrapper.promise;
		},

		// Remove an item from the renderQueue.
		remove : function(item) {
			var key = this.getKeyForItem(item);
			if (key == null) {
				console.warn("renderQueue.remove(",item,"): key property '"+this.keyProperty+"' is null!");
				return;
			}
			// remove from queue
			this._queue.removeWhere(function(wrapper){return wrapper.key === key;});

			// if it's the element that's currently running, cancel and/or reject it
			var current = this._current;
			if (current && current.key === key) {
				// attempt to cancel, will likely not work
				if (current.activePromise) {
					if (current.activePromise.cancel) current.activePromise.cancel();
					if (current.activePromise.reject) current.activePromise.reject();
				}
				// but the reject should work
				current.promise.reject();
			}

			this.checkQueueSoon();
		},

		// Clear ALL items from the queue.
		clear : function() {
			this._queue.forEach(this.remove, this);
		},


	//
	//	queue management
	//

		checkQueueSoon : function() {
			this.soon("checkQueue", this.delay);
		},

		// Check to see if we should be executing some item in the queue.
		checkQueue : function() {
			this.clearSoon("checkQueue");

			// if we're in the middle of something, forget it -- we'll get called back.
			if (this._current) return;

			// get the next item to execute
			var current = this._current = this._queue.shift();

			// if nothing to do, we're outta here!
			if (!current) return;

			current.activePromise = this.renderNow.call(this.scope, current.item)
									.done(function(url) {
										try {
											current.promise.resolve(url);
										} catch (e){}
									})
									.fail(function() {
										try {
											current.promise.reject();
										} catch (e){}
									})
									.always(function(){
										delete this._current;
										this.checkQueueSoon();
									}.bind(this));
		}


	},
//
// class methods
//
	{
		// Render a blob of HTML using html2Canvas.
		// The `scale` is the scaling ratio for the HTML.
		// Returns a promise which will resolve with a canvas containing the image.
		renderViaCanvas : function($blob, scale, returnAs) {
// TODO: scale not supported
			if (!scale) scale = 1;
			if (!returnAs) returnAs = "base64";	// "base64", "image" or "canvas"

			function _renderCanvas() {
				var deferred = $.Deferred();
				try {
					html2canvas($blob[0], {
						// logging		: true,
						background	: "white",					// ????
						onrendered	: function(canvas) {
							if (returnAs === "base64") {
								deferred.resolve(canvas.toDataURL());
							}
							else if (returnAs === "canvas") {
								deferred.resolve(canvas);
							}
							else {
								var image = new Image();
								image.onload = function() {
									deferred.resolve(image);
								};
								image.src = canvas.toDataURL();
							}
						},
					});
				} catch (e) {
					deferred.reject(e);
				}
				return deferred.promise();
			}

			return this._doWithElementInDom($blob, _renderCanvas);
		},

		// Render a blob of HTML using NativeApp in-browser rendering.
		// The `scale` is the scaling ratio for the HTML.
		// Returns a promise which will resolve with a base64 string, image, or canvas
		// containing the image and an array containing any image urls that failed to load.
		renderViaNative : function($blob, scale, returnAs) {
			if (!scale) scale = 1;
			if (!returnAs) returnAs = "base64";	// "base64", "image" or "canvas"

			// console.log('renderViaNative');

			if (!Browser.is.nativeapp) {
				var err = new Error("renderViaNative only works in a native app environment");
				return $.Deferred().reject(err);
			}

			function _renderNative() {
				var deferred = $.Deferred();
				var region = $blob.offsetRect();
				// NativeApp.renderRegion() returns a base64 encoded data url
				var base64 = NativeApp.renderRegion(region, scale);

				if (returnAs === "base64") {
					deferred.resolve(base64);
				}
				else {
					var image = new Image();

					if (returnAs === "image") {
						image.onload = function(){
							deferred.resolve(image);
						};
					}
					else if (returnAs === "canvas") {
						image.onload = function() {
							var canvas = document.createElement("canvas");
							canvas.width = image.width;
							canvas.height = image.height;
							var ctx = canvas.getContext("2d");
							ctx.drawImage(image, 0, 0);
							deferred.resolve(canvas);
						};
					}
					image.onerror = function(error) {
						deferred.reject(error);
					};
					image.src = src;
				}
				return deferred.promise();
			}

			return this._doWithElementInDom($blob, _renderNative);
		},


		// if `$element` is not in the DOM, temporarily add it to the DOM,
		// position it far away from visible, wait for all images under `$element` to load,
		// run `callback`, if callback returns a promise, wait for it to resolve,
		// then restore `$element`'s original (no)DOM state.  the promise returned
		// by this method will resolve with the results of `callback` with the addition
		// of an array containing the urls of any images that failed to load.
		_doWithElementInDom : function($element, callback) {
			var self = this;
			if (!$element.jquery) $element = $($element);

			var alreadyInDom = ($element.parents("html").length > 0), oldCSS;
			if (alreadyInDom) return waitForImagesToLoadThenDoCallback();

			// remember old position
			oldCSS = {
				top 	: $element.css("top"),
				left	: $element.css("left"),
				display	: $element.css("display")
			};

			// add to DOM, position far from visible
			$element.css({
				display:"block",
				left:0,
				top:10000
			});
			// append to body
			$("body").append($element);

			return waitForImagesToLoadThenDoCallback()
					.always(function() {
						// restore previous CSS and remove from DOM
						$element.detach().css(oldCSS);
					});

			function waitForImagesToLoadThenDoCallback() {
				var loadFailures;
				// wait for images in $element to load
				return self._waitForImagesToLoad($element)
						.then(function(_loadFailures) {
							// store any image load failures
							loadFailures = _loadFailures;
							// call callback, if it returns a promise, it will be waited upon
							return callback();
						}).then(function() {
							// now append the image load failures to any results from callback
							var args = Function.args();
							args.push(loadFailures);
							// and make a resolved promise with the new args list
							return $.when.apply($, args);
						});
			}
		},

		// return a promise that resolves when all images underneath $root are loaded
		_waitForImagesToLoad : function($root) {
			// TODO: add timeout

			// Get all images which actually have a src set.
			var $images = $root.find("img").filter(function(){ return !!this.src});

			// If no images, return resolved promise with empty errors array.
			if ($images.length === 0) return $.when([]);

			var deferred = $.Deferred();
			var loadsRemaining = 0;
			var loadErrors = [];

			// Create a new Image object with the source the same as the image element's
			// and call ourselves back when it completes.
			$images.each(function(index, element) {
				loadsRemaining++;
				var image = new Image();
				image.onload = function(){
					image = null;
					imageLoadDone();
				};
				image.onerror = function(error) {
					image = null;
					// store image urls that failed to load
					console.error("image failed to load: "+element.src);
					loadErrors.append(element.src);
					imageLoadDone();
				};
				image.src = element.src;
			});
			return deferred.promise();

			// When all image loads have completed (success or failure),
			// resolve our promise with the list of urls that failed to load.
			function imageLoadDone() {
				loadsRemaining--;
				if (loadsRemaining <= 0) {
					deferred.resolve(loadErrors);
				}
			}
		},

		// Debug routine to test rendering via various code paths.
		testRender : function($t, scale) {
			if (!$t) {
				if (!window.$testElement) {
					$t = $('<button class="shiny compact">Test Button for Testing</button>');
					$t.css({
						top:10000,
						position:"absolute",
					});
					$("body").append($t);
					window.$testElement = $t;
				} else {
					$t = window.$testElement;
				}
			}

			if (window.$testCanvas) $testCanvas.remove();

			RenderQueue.renderViaNative($t, scale)
				.then(function success(canvas) {
						console.log("rendered");
						var $canvas = $(canvas);
						window.$testCanvas = $canvas;

						$canvas.css({
							position: "absolute",
							top: 100,
							left: 100,
							"z-index": 30000,
							background: "rgba(255,0,0,0.5)",
						});
						$("body").append($canvas);
					}, function failed(error) {
						if (error) {
							console.log(error, error.stack);
						} else {
							console.log("unknown error");
						}
					});
		},

	});	// end new Class("RenderQueue")

	return RenderQueue;
});
