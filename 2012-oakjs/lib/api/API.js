/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

Module.define("oak/lib/api/API",
"oak/lib/core/Singleton,oak/lib/core/Debuggable,oak/lib/api/APIError,oak/lib/api/APICall",
function(Singleton, Debuggable, APIError, APICall) {

	new Singleton("API", {
		mixins : "Debuggable",

		// "sessionid" which identifies this session
		//	will be set by User.... TODO
		sessionid : null,

		//  Call a named operation.
		//	Yields a promise to be resolved when the call completes or fails.
		//
		//  callOptions is a map of:
		//		- id				- name of your method call, for debugging.
		//		- url				- URL to call (will be substituted with values in parameters)
		//		- type				- GET or POST
		//		- dataType			- dataType of the response, defaults to "html".  See jQuery.ajax().
		//		- synchronous		- defaults to false.  See jQuery.ajax();
		//		- params			- map of properties to substitute in the url (GET or POST)
		//		- context			- scope for callbacks
		//		- data				- POST parameters:
		//								- string type == explicit post parameters
		//								- object type == key:value pairs to put in post
		//		- processData		- function to use to process the $data result of successful return
		//								BEFORE it is returned to callers in done()
		//		- loadingMessage	- if set, we'll do a `UI.showNotice(loadingMessage)` while the call is in-flight.
		//		- sucessMessage		- message to show the user on success via `UI.flashNotice()`
		//		- flashError		- if true and we get an error response, we'll do a `UI.flashNotice()` of the error.
		//
		//	done() callbacks are called as:
		//		callback( response.$data, callOptions)
		//
		//	fail() callbacks are called as:
		//		errback( errors, callOptions)
		//
		//
		// 	RESPONSE CODES as of 12/19/2011
		// 		status 0 	== it worked!
		// 		status 200	== it worked!
		// 		status 400	== generic error
		// 		status 403	== another type of authorization failure
		//						(specific to cross-site scripting problem)
		// 		status 404	== unrecognized URL
		// 		status 500	== server error -- will not have a valid <response> format!
		//
		//
		//	RESPONSE FORMAT
		//		<?xml version="1.0"?>
		//		<response format='1' status='200'>
		//			<message>Success</message>
		//			<data>
		//				... call-specific data goes here ...
		//			</data>
		//			<error>
		//				<code>-1234</code>
		//				<name>Hint as to error, don't show to user</name>
		//				... other error specific stuff ...
		//			</error>
		//		</response>
		call : function(callOptions) {
			// Take the simple call options and make an APICall instance from it.
			//	This sets up default ajax parameters, and allows us to attach things to the apiCall
			//	without modifying the original set of call options.
			var apiCall = new APICall(callOptions);
			if (this.debug) console.group("$api.call("+apiCall.id+"):",apiCall);

			// should we show a message to block the UI while this is running?
			var loadingMessage = apiCall.loadingMessage;
			if (loadingMessage) UI.showModalNotice(loadingMessage);
			var ajaxArgs = {
				dataType	: apiCall.dataType,
				url 		: apiCall.url,
				type 		: apiCall.type,
				cache		: false,
				async		: !apiCall.synchronous
			};

			// if we're posting, append any post data to the ajax request
			if (apiCall.type == "POST") {
				// All posts MUST have data
				apiCall.data = (apiCall.data || {});
				ajaxArgs.data = apiCall.data;
			}

			// create the jQuery AJAX request
			var ajaxRequest = apiCall.request = $.ajax(ajaxArgs);

			// create a promise which will be called when we're done loading
			var responsePromise = apiCall.responsePromise = new $.Deferred();
			responsePromise.request = ajaxRequest;

			// the context for callbacks is either apiCall.context if passed, or the promise itself
			var context = apiCall.context || responsePromise;

			// callback -- normalize the data and calls the responsePromise
			//	NOTE: this same code is (eventually) called on success or failure
			function ajaxDone(responseXML) {
				API._processResponseXML(apiCall, ajaxRequest, responseXML);

				if (API.debug) console.group("API." + apiCall.id,
												(apiCall.success ? " succeeded with(" : " failed with("),
												(apiCall.success ? apiCall.$data      : apiCall.errors),
												", ", apiCall,")");

				var responseMessage;

				//
				// SUCCESS CASE:
				//
				//	NOTE: IE8 returns status == 0 for success. ???
				if (apiCall.success) {
					responseMessage = apiCall.successMessage;
					responsePromise.resolveWith(context, [apiCall.$data, apiCall]);
				}

				//
				//	ERROR CASE
				//
				else {
					// special case for authentication error
					if (status == 403) API.onAuthenticationFailure(apiCall.errors, apiCall);

					responseMessage = (apiCall.flashError ? apiCall.errorMessage : undefined);
					// reject the response whether an auth error or other error
					responsePromise.rejectWith(context, [apiCall.errors, apiCall]);
				}

				if (responseMessage)		 	UI.flashNotice(responseMessage);
				else if (loadingMessage)		UI.hideNotice(loadingMessage);

				if (API.debug) console.groupEnd();	// group end for the ajaxDone()
				if (API.debug) console.groupEnd();	// group end for the original API.call()
			}

			// normal success call
			ajaxRequest.done(ajaxDone);

			// if we get a bad response code from the server
			//	it's either because the response couldn't actually complete (eg: a 404)
			//	or because of a server error.
			ajaxRequest.fail(function(request, textStatus) {
				var status = parseInt(textStatus) || 0;
				var responseXML = request.responseText;

				// if we got a page-not-found, make up a <response> for it
				if (status == 404) responseXML = API._fake404Response(apiCall, ajaxRequest, responseXML);

				// if the response XML doesn't contain a <response> object, fake up a proper response
				if (!responseXML.contains("<response")) {
					responseXML = API._fakeResponse(apiCall, ajaxRequest, responseXML);
				}

				// call the ajaxDone method, which actually processes the error
				ajaxDone(responseXML);
			});

			return responsePromise;
		},	// end .call()


		// TODO
		onAuthenticationFailure : function(errors, apiCall) {
			console.error("Authentication failure.", errors);
		},


	//
	//	internal methods to help API.call() above
	//

		// process a <response> XML bit for ajaxDone() above
		_processResponseXML : function(apiCall, ajaxRequest, responseXML) {
			// remember the full response
			apiCall.responseXML = responseXML;

			// convert responseXML into a jQuery vector of XML/HTML
			var $response = API.parseOXML(responseXML);

			// pull out the <response> object if it is nested in there
			if ($response[0] && $response[0].tagName.toLowerCase() != "response") {
				$response = $response.find("response");
			}
			// remember the full response
			apiCall.$response = $response;

	// TODO: error if there's no response object?

			var status = apiCall.status = parseInt($response.attr("status"),10) || 0;
			apiCall.success = (status === 200 || status === 0);

			var $data = $response.children("data");

			// call specified processData() function to extract part of the data, etc.
			if (typeof apiCall.processData == "function") {
				$data = apiCall.processData($data, apiCall);
			}

			apiCall.$data = $data;

			if (!apiCall.success) {
				var $errors = $response.find("error");
				var errors = [], error, i = -1;
				while((error = $errors[++i])) {
					errors.push(new APIError(error));
				}
				apiCall.errors = errors;
				var $message = $response.find('message');
				if ($message.length) apiCall.errorMessage = $message.text();
			}
		},


		// generate a <response> from an apiCall which returns a 404
		_fake404Response : function(apiCall, ajaxRequest, responseXML) {
			return "<response status='404'>"
							+ "<error>"
								+ "<code>404</code>"
								+ "<name>Invalid URL: "+apiCall.url+"</name>"
							+"</error>"
						+ "</response>";
		},

		// generate a <response> from an apiCall which returns a 404
		_fakeResponse : function(apiCall, ajaxRequest, responseXML) {
			return "<response status='"+ajaxRequest.status+"'>"
							+ "<error>"
								+ "<code>"+ajaxRequest.status+"</code>"
								+ "<name>"+responseXML+"</name>"
							+ "</error>"
						  + "</response>";

		},

	//
	//	generic api calls
	//

		// return the current time according to the server as   YYYYMMDD.HHMMSS
		getServerTime : function(synchronous) {
			var params = {
				id		: "getServerTime",
				url 	: "dyn/api/publisher/now",
				type 	: "GET",
				// return just the time portion as a string
				processData : function($data) {
					return $data.html().trim();
				}
			};
			if (synchronous) params.synchronous = true;

			return API.call(params);
		},


	//
	//	"webkey" is a string generated by the server which uniquely identifies this device
	//
	//
	//	"device id" for this browser, to identify it to the server
	//
	//	 In UI.initialize(), we check to see if we already have one
	//		and automatically the server for one if we don't have one
	//		BEFORE the app starts up (so we can count on it being available).
	//
		loadWebkey : function(force) {
			if (API.debug) console.group("API.loadWebkey(",arguments,")");
			var promise;

			// if we already have a valid webkey
			//	and they did not indicate that they want to FORCE the transaction
			//	just return the old value.
			if (API.webkey && force != "FORCE") {
				if (API.debug) console.info("Using existing browser device id", API.webkey);
				promise = new $.Deferred();
				promise.resolve(API.webkey);
			} else {
				API.clearWebkey();

				// Response looks like:
				//	<?xml version="1.0"?>
				//		<response format='1' status='200'>
				//		<message>Success</message>
				//		<data><gen_webkey>a0e874b1adde0eb4ce5394d272b5e71f</gen_webkey></data>
				//	</response>
				var promise = API.call({
					id		: "loadWebkey",
					url 	: "dyn/api/gen-webkey/",
					type 	: "GET",
					processData : function($data) {
						var keyValue = $data.children("gen_webkey").text();
						API.webkey = keyValue;
						Browser.cookie("webkey", keyValue);
						return keyValue;
					}
				});
				if (API.debug) {
					promise.done(function(deviceId){
						console.info("API.loadWebkey() callback:  Loaded browser device id: ", deviceId)
					});
				}
			}
			if (API.debug) console.groupEnd();
			return promise;
		},
		// debug
		clearWebkey : function() {
			if (API.debug) console.info("API.clearWebkey(",arguments,")");
			Browser.cookie("webkey", null)
		},




	//
	//	utility functions
	//
		// Make sure a list of keys in a params object are non-empty.
		// Throws if any parameters are not found.
		// messagePrefix should be something like:    "yourMethod():"
		checkMandatoryParams : function(params, keys, messagePrefix) {
			if (!messagePrefix) messagePrefix = "";
			if (!params)				throw messagePrefix + " You must specify parameters {" + keys + "}";
			var i = -1, key;
			while ((key = keys[++i])) {
				var value = params[key];
				if (value == null && value === "") throw messagePrefix + " You must specify " + key;
			}
		},

	//
	//	debug
	//

		// Echo back the arguments of the function.
		//	Useful if you just need *some* callback and aren't sure what arguments are being passed.
		echo : function() {
			if (Browser.is.ie && Browser.is.v8) {
				console.dir(arguments);
			} else {
				console.warn(arguments);
			}
		}

	});	// end new Singleton("API")



	//
	//	loading Owen-style ghetto XML
	//	TODOC
	//	TODO: move into other files
	//
	API.extend({
		// Convert strict xml/xhtml text into DOM objects, returned as a jQuery vector.
		// NOTE:  for IE8, we use "$.parseXML()" to attempt to parse as strict XML.
		parseOXML : function(xml) {
			// if IE 8 -- attempt to parse as strict XML
			//	if this doesn't work, or another browser, just parse as HTML
			if (Browser.is.ie && Browser.is.v8) {
				try {
					var xmlDoc = $.parseXML(xml);
					return $(xmlDoc).children();
				} catch (e) {}
			}

			return API.parseOHTML(xml);
		},

		//	Convert slacker-owen-style xml/xhtml into a jQuery vector of normalized HTML.
		parseOHTML : function(html) {
			// NOTE: IE8 handles unary tags automatically, and needs this syntax to work
			if (Browser.is.ie && Browser.is.v8) {
				return $("<div></div>").html(html).children();
			} else {
				// other browsers (FF) don't like unknown unary tags, so convert them to binary tags first
				html = html.expandUnaryTags();

				// convert the html into a jQuery vector by inserting as HTML into a div...
				var parent = document.createElement("div");
				parent.innerHTML = html;

				// and return a vector of the div's children
				return $(parent.children);
			}
		},

		//	Convert slacker-owen-style xml/xhtml into a jQuery vector of normalized HTML
		//	ALSO takes all <img src="..."> and converts to <img deferred-src="...">
		//		 so we can load the images on demand.
		parseOHTMLAndDeferImages : function(html) {
			// replace all  <img src="..."> tags with <img deferred-src="..."> tags
			html = html.replaceAll(/<img ([^<]*?)src=["'](.*?)["']([^<]*?)>/i, "<img $1deferred-src=\"$2\"$3>");
			return API.parseOHTML(html);
		},


		// Syntactic sugar to load an XML file and convert to jQuery vector,
		//	setting datatype and cache=false automatically.
		xmlLoader : function(url, settings) {
			if (arguments.length == 1) {
				if (typeof url == "string") settings = {url:url};
				else						settings = url;
			} else {
				if (!settings) settings = {};
				if (!settings.url && url) settings.url = url;
			}
			if (!settings.dataType == undefined) 	settings.dataType = "oxml";
			if (settings.cache == undefined) 		settings.cache = false;
			return $.ajax(settings);
		},

		// convert a simple, possibly nested jquery-wrapped XML structure into a JSON-like object
		nestedXMLToObject : function($root) {
			var object = {};
			$root.children("*").each(function(index, element) {
				var tagName = element.tagName.toLowerCase();
				var value;
				if (element.children.length) {
					value = API.nestedXMLToObject($(element));
				} else {
					value = $(element).text();
				}
				//console.warn(tagName, value);
				object[tagName] = value;
			});
			return object;
		}

	});	// end API.extend()

	//
	//	Add "oxml" and "ohtml" datatypes to do the above conversions for us.
	//
	$.ajaxSetup({
		converters: {
			"text oxml"			: API.parseOXML,
			"text ohtml"		: API.parseOHTML,
			"text ohtml-images" : API.parseOHTMLAndDeferImages
		}
	});

	return Singleton.API;
});	// end define("oak/lib/api/API")

