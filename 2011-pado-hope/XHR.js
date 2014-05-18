/***	XHR, for loading things via XMLHttpRequest.	***/

//TODO: use {{}} aliasing
//TODO: smarter save semantics

(function() {

var _NAMED_PATH_MATCHER = /{{(.*?)}}/;
var _FULL_PATH_MATCHER = /[^#?]*/;
var	_CACHE_PARAMS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

var XHR = {
	debug : hope.debug("XHR"),
	
	// constants for http method
	GET 	: "GET",
	POST 	: "POST",
	
	// don't cache things by default
	cache : false,

	// Map of named path => url path.
	//	Add named paths to this object to dereference them via Script.expand()
	paths : {
		// path to head of hope scripts, set in loader
		hope : HOPE_PATH
	},
	
	addPath : function(name, url) {
		XHR.paths[name] = url;
	},

	// given a @url, interpret any named paths in the url (eg:  "{{hope}}foo")
	expand : function(url) {
		if (!url) return url;
		var match = url.match(_NAMED_PATH_MATCHER);
		if (match) {
			var path = XHR.paths[match[1]];
			if (!path) 	console.error("Named path not found in url "+url);
			else		url = url.replace(match[0], path);
		}
		return url;
	},
	
	collapse : function(url) {
		for (var name in XHR.paths) {
			var path = XHR.paths[name];
			if (url.indexOf(path) === 0) return "{{"+name+"}}"+url.substr(path.length);
		}
		return url;
	},
	
	// IF XHR.cache is false or you pass flase into `cache`,
	//	to defeat browser caching, append a 'unique-y' parameter to the end of a url.
	// 	Note: We use a single letter, which is not quite so random, but makes the cache param short.
	addCacheParam : function(url, cache) {
		if (cache === undefined) cache = XHR.cache;
		if (!cache) {
			var random = Math.floor(Math.random()*_CACHE_PARAMS.length);
			var param = _CACHE_PARAMS[random];
			return url + (url.indexOf("?") > -1 ? "&" : "?") + "_="+param;
		} else {
			return url;
		}
	},
	
	// extract full path of url, eg:
	//	http://server.com:80/path/to/file.html
	fullPath : function(url) {
		return (""+url).match(_FULL_PATH_MATCHER)[0];
	},

	// extract path NOT INCLUDING the fileName
	//	http://server.com:80/path/to/
	path : function(url) {
		url = XHR.fullPath(url);
		return url.substr(0, url.lastIndexOf("/")) + "/";
	},
	
	
	// extract full path of url, eg:
	//	file.html
	fileName : function(url) {
		url = XHR.fullPath(url);
		return url.substr(url.lastIndexOf("/"));
	},	
	
	_makeReadyStateFn : function(request, url, callback, errback, scope) {
		request.onreadystatechange = function() {
			if (request.readyState !== 4) return;
			// iOS local XHR returns status "0" for complete
			if (request.status === 200) {// || request.status === 0) {
				var response = request.responseText;
				if (callback) {
					callback.call(scope, response, request);
				} else if (XHR.debug) {
					console.info("loaded "+url+" w/no callback:\n", response);
				}
			} else if (errback) {
				errback.call(scope, request.status, request);
			} else if (XHR.debug) {
				console.warn("Couldn't load "+url, request);
			}
		}
	},


	// Asynchronously fetch an arbitrary file via XHR.
	// 	@callback is called with the responseText.
	//	@errback is called if can't load the file.
	get : function (url, callback, errback, scope, cache) {
		var request = new XMLHttpRequest();
		url = XHR.expand(url);
		request.open(XHR.GET, XHR.addCacheParam(url, cache), true);
		XHR._makeReadyStateFn(request, url, callback, errback, scope);
		request.send(null);
		return request;
	},
	
	
	// SYNCHRONOUSLY fetch an arbitrary file via XHR.
	// 	@returns the responseText immediately if it worked.
	//	@errback is called if can't load the file, returns <undefined>.
	getImmediately : function (url, errback, scope, cache) {
		var request = new XMLHttpRequest();
		url = XHR.expand(url);
		request.open(XHR.GET, XHR.addCacheParam(url, cache), false);
		request.send(null);
		if (request.status === 200 || request.status === 0) {
			return request.responseText;
		} else if (errback) {
			errback.call(scope, request.status, request);
		}
	},
	
	// encode an object of parameters
	encode : function(params) {
		// format the params
		var output = [];
		for (var key in params) {
			output.push(encodeURIComponent(key)+"="+encodeURIComponent(params[key]));
		}
		return output.join("&");
	},
	
	
	// POST some data
	post : function(url, urlParams, postBody, callback, errback, scope) {
		url = XHR.expand(url).appendParameters(urlParams);
		var request = new XMLHttpRequest();
		request.open(XHR.POST, url, true);
		XHR._makeReadyStateFn(request, url, callback, errback, scope);
		if (typeof postBody == "object") {
			postBody = this.encode(postBody);
		}
		request.send(postBody);
		return request;
	},
	
	// SYNCHRONOUSLY post some data via XHR.
	// 	@returns the responseText immediately if it worked.
	//	@errback is called if can't load the file, returns <undefined>.
	postImmediately : function (url, urlParams, postBody, callback, errback, scope) {
		url = XHR.expand(url).appendParameters(urlParams);
		var request = new XMLHttpRequest();
		request.open(XHR.POST, url, false);
		request.send(postBody);
		if (request.status === 200 || request.status === 0) {
			return request.responseText;
		} else if (errback) {
			errback.call(scope, request.status, request);
		}
	},

	
	// Save @data to a @file on the server.s
	//	ASSUMES:
	//		- "save.php" is in the "editor/" directory relative to main ui file and is executable.
	//		- @file you're writing to is relative to save.php.
	//		- Directory which owns file you're writing to is writeable.
	//		- You know what the EFF you're doing.
	save : function(file, data, callback, errback) {
		XHR.post("editor/save.php", {file:file}, data, callback, errback);
	},
	
	
	
	// Submit a URL request to another domain through a URL proxy.
	//	
	//	NOTE: this is not necessarily safe -- using this can open you up to 
	//			Cross-Site-Scripting (XSS) attacks!
	//
	//	NOTE: For this to work, you need to set `XHR.proxyUrl` to a URL 
	//			which can be used to proxy a proxy from your server.
	//			In `XHR.proxyURL`, use `{{url}}` to indicate where the desired URL should go.
	//			Also, note that the `{{url}}` passed in will be URL-encoded.
	//
	proxyUrl : null,
	
	proxy : function(url, callback, errback, scope, cache) {
		var proxyUrl = XHR.proxyUrl;
		if (!proxyUrl) throw "You must define XHR.proxyUrl to use the XHR.proxy() method";

		// substitute the escaped URL in the proxyUrl
		proxyUrl = proxyUrl.expand({url:escape(url)});
		
		// and just call as a normal get
		var request = XHR.get(proxyUrl, callback, errback, scope, cache);
		window.request = request;
		return request;
	}
};
hope.setGlobal("XHR", XHR);


// set XHR.paths.page to the base URL of the page (minus any query stuff)
XHR.addPath("page", XHR.path(""+window.location));

// default XHR.paths.ui to the same as XHR.paths.page	(ui may change it in user code)
XHR.addPath("ui", XHR.paths.page);


})();// end hidden from global scope
