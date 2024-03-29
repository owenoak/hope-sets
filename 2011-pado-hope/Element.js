
/*** Element object extensions ***/

Script.require("{{hope}}Function.js,{{hope}}Object.js,{{hope}}List.js", function(){


// make it easy to distinguish between Text nodes and Elements
Text.prototype.isTextNode = true;


var E = Element, EP = E.prototype;
EP.constructor = E;




// if cookie "debug.Element" is set, we'll show debug messages when creating/adapting tags
//	and set attributes on Elements so you can tell what's going on
E.debug = hope.debug("Element");

// set the "ElementData" debug flag to put an attribute on each element
//	so you can tell what has been given .DATA, and see who all's .DATA has been cleared.
E.debugData = hope.debug("ElementData");

E.toRef = function(){ return "Element" };


//
//	global select/selectAll functions (equivalent of jQuery's $)
//

// return an ElementList which matches the selector globally
window.selectAll = document.selectAll = document.getChildren = 
  function selectAll(selector, includeMe) {
	if (typeof selector !== "string") return selector;
	var root = (this === window ? document : this);
	// NOTE: ElementList is declared in ElementList.js
	try {
		var elements = root.querySelectorAll(selector);
	} catch (e) {
		console.debug("Error thrown attempting to query selector ",selector," of ",this,":\n",e);
		elements = [];
	}
	if (window.ElementList) {
		elements = new ElementList(elements);
		if (includeMe && root.matches && root.matches(selector)) elements.prepend(root);
	}
	return elements;
}

// return a single E which matches the selector globally
window.select = document.select = document.getChild = 
  function select(selector, error) {
	if (typeof selector !== "string") return selector;
	var root = (this === window ? document : this), it;
	try {
		it = root.querySelector(selector);
	} catch (e) {
		console.debug("Error thrown attempting to query selector ",selector," of ",this,":\n",e);
	}
	if (!it && error) throw error;
	return it;
}


// URFF - ios 3.2 doesn't define webkitMatchesSelector
EP._matches = EP.webkitMatchesSelector ||  EP.mozMatchesSelector;

// define a reasonably quick matches() routine
if (!EP._matches) {
	EP._matches = (function() {
		var parent = document.createElement("div"), 
			hadParent, matches, i, element
		;
		return function(selector) {
			if (hadParent = !this.parentNode) {
				parent.appendChild(this);
				matches = parent.querySelectorAll(selector);
				parent.removeChild(this);
			} else {
				matches = this.parentNode.querySelectorAll(selector);
			}
			if (matches.length) {
				i = -1;
				while (E = matches[++i]) if (E === this) return true;
			}
			return false;
		}
	})();
}


//
//	static methods for Element
//	

var __CONTAINER = document.createElement("div");
window.__CONTAINER = __CONTAINER;
hope.extend(E, {	
	// Create a new element of specified type with @attributes.
	//	To set innerHTML, pass attribute @html.
	//	To set value, pass attribute @value.
	//	@setupTags false to skip setting up tags in the created element
	create : function(tag, attributes, setupTags) {
		var element = document.createElement(tag);
		if (attributes) {
			for (var attribute in attributes) {
				var value = attributes[attribute];
				switch (attribute) {
					case "html" 	: element.html = value; break;
					case "className": element.className = value; break;
					case "value" 	: element.value = value; break;
					default			: element.setAttribute(attribute, value);
				}
			}
		}
		if (setupTags !== false) Element.initializeElement(element);
		return element;
	},
	
	
	// Given some HTML, inflate it to an ElementList of nodes (including text nodes).
	// pass a @selector to pull the first matching element out
	//	otherwise we'll return an ElementList of the childNodes
	// NOTE: this DOES initialize() the returned elements!
	inflate : function(html, selector) {
		__CONTAINER.innerHTML = html.expandUnaryTags();
		Element.initializeElements(__CONTAINER.childNodes);
		if (selector) {
			var child = __CONTAINER.getChild(selector);
			return (child ? __CONTAINER.removeChild(child) : null);
		}
		var list = new ElementList(__CONTAINER.childNodes);
		return list;
	}
});





EP.extend = hope.extendThis;
EP.extendIf = hope.extendThisIf;


//
//	Data access -- efficiently adding external stuff to an element
//
//	- Stick complex stuff (args, arrays, fns) 
//			on element.DATA
//		rather than on element directly
//	- cache element.DATA.* in your function for efficiency if referring to it more than once
//

//TODO: observe DOM node deleted to clear data?

var ELEMENT_ID = window.ELEMENT_ID = 1;
var ELEMENT_INSTANCE_DATA = window.ELEMENT_INSTANCE_DATA = {};

// manually set up the data for Element.prototype, or Firefox throws a fit.
EP.dataId = 0;
ELEMENT_INSTANCE_DATA[0] = {};


EP._setUpData = function () {
	if (this.hasOwnProperty("dataId")) return;
//console.warn("setting up data for ",this);
	var id = this.dataId = ELEMENT_ID++;
	if (Element.debugData) this.setAttribute("_dataId", id);

	// instance properties, NOT inherited from superclasses
	ELEMENT_INSTANCE_DATA[id] = {};
	return this;
}



//
//	data access -- for adding external stuff to an element
//
EP.extend({	
	// data NOT inherited from superclasses
	DATA : new Getter(
		function getInstanceData() {
			if (!this.hasOwnProperty("dataId")) this._setUpData();
			return ELEMENT_INSTANCE_DATA[this.dataId];
		}
	),
	
	//
	//	unload me!
	//
	onUnload : function() {
		if (this._unloaded) return;
		try {
			// tell all of our children to unload first
			//	turns out this is pretty fast
			// YUCK:  Gecko needs the check for this.childNodes.length here 
			//			BEFORE you try to get the childElementCount or it will barf
			if (!this.childrenUnloaded && this.childNodes.length && this.childElementCount > 0) {
				var i = -1, child, children = this.children;
				while (child = children[++i]) child.onUnload();
				this.childrenUnloaded = true;
			}
		} catch (e) {
			if (hope.debug.unload) console.error(e, this);
		}
		
		var id = this.dataId, 
			data = ELEMENT_INSTANCE_DATA[id]
		;
		if (id === -1 || !data) return;

		// clear the constructor pointer -- this is potentially a very big leak
		this.constructor = this._adapter = null;
		
		// if we have any updaters, clear them
		var map = this.unloadMap, property, method;
		if (map) {
			for (var property in map) {
				method = map[property];
				if (! (property = this[property]) ) return;
//				if (hope.debug.unload) console.debug("processing unloadMap:",method,this);
				this[method](property, data);
			}
		}

//LEAK
		this.dataId = -1;
		if (Element.debugData) this.removeAttribute("_dataId");
//LEAK
		delete this.__proto__;					// potentially dangerous, and probably not necessary
//		this.__proto__ = Element.prototype;		// safer, still probably not necessary

//LEAK
		ELEMENT_INSTANCE_DATA[id] = null;
		this._unloaded = true;
	},
	
	// Map of lowercase attribute name => property name for that attribute.
	//	Set up automatically if you extend an element with an Attribute
	unloadMap : new InstanceMap({name:"unloadMap", tupelize:true, inherit:true}),
});


// clean up memory on page unload.  
hope.unload(function() {
	if (hope.debug.unload) console.group("unloading elements");
	var t0 = new Date().getTime();

	// start at the body and recursively call onUnload() on all elements
	document.body.onUnload();

	var t1 = new Date().getTime();
	if (hope.debug.unload) {
		console.warn("unloading elements took "+(t1-t0)+" msec");
		console.groupEnd();
	}

	// clean the Element data cache
//LEAK: put this back
	delete window.ELEMENT_INSTANCE_DATA;
	delete window.DATA;
	delete document.DATA;
});




EP.extendIf({

	//
	//	basic class stuff
	//
	as : Class.prototype.as,

	// remove this element from our parent OR remove an element from us
	remove : function(it) {
		if (arguments.length === 0) {
			if (this.parentNode) this.parentNode.removeChild(this);
		} else if (it instanceof E) {
			this.removeChild(it);
		} else if (it instanceof Array) {
			it.forEach(function(element) {
				this.removeChild(element);
			}, this);
		}
		return this;
	},
	
	// tag name, but ALWAYS lower case
	tag : Getter(function(){return this.tagName.toLowerCase()}),

	//
	// css checking and subsetting
	//

	// return all descendants which match selector
	// if includeMe is true, includes the element in the potential matches (first)
	getChildren : document.getChildren,
	
	// return first descendant which matches selector
	getChild : document.getChild,
	
	// return first parent (including us if @includeUs is not false) which matches selector
	selectUp : function(selector, includeUs) {
		if (typeof selector === "string" && selector.charAt(0) === "$") return window[selector];
		
		var target = this;
		if (includeUs === false) target = target.parentNode;
		while (target) {
			if (!target.matches) return;
			if (target.matches(selector)) return target;
			target = target.parentNode;
		}
	},
	
	// return direct children which match the selector
	selectChildren : function(selector) {
		if (this.childElementCount === 0) return new ElementList();
		return this.elements.where(function(it) {
			return it.matches(selector);
		});
	},
	
	
	// this is a different kind of selection -- selecting the contents visually (eg: for copying)
	selectContents : function() {
		// clear the selection
		var selection = window.getSelection();
		if (selection.rangeCount > 0) selection.removeAllRanges();
		
		// create a range with our contents
		var range = document.createRange();
		range.selectNodeContents(this);

		// and add it to the selection
		selection.addRange(range);
	},
	
	
	// Return true if we match some @selector.  
	//	Pass:
	//		- a css selector string or
	//		- a function (called with @this as the element), we match if fn result is truthy
	//	NOTE: won't work in IE
	matches : function(selector) {
		if (typeof selector === "string") return this._matches(selector);
		if (typeof selector === "function") return !!selector.apply(this);
	},

	// return our child number in our parentNode
	childNumber : Getter(function() {
		if (!this.parentNode) return -1;
		var children = this.parentNode.elements, index = -1;
		while (children[++index] != this) {}
		return index;
	}),


	//
	//	generic attribute manipulation
	//

	//	pass 1 argument to get the value of a single attribute
	//	pass 2 arguments to set the value of an attribute
	//		note: pass `null` or `""` to clear attribute value
	attr : function(name, value) {
		// TODO: check value before setting so as to not perturb the dom?
		if (arguments.length === 1) return this.getAttribute(name);
		if (value == null) 	this.removeAttribute(name);
		else				this.setAttribute(name, value);
		return this;
	},
	
	//	return a map of current attributes
	attrs :  new Property({
		get : function() {
			var attrs = {}, i = -1, attr, attributes = this.attributes, value;
			while (attr = attributes[++i]) {
				attrs[attr.nodeName] = attr.nodeValue;
			}
			return attrs;
		},
		
		set : function(attrs) {
			if (!attrs || typeof attrs !== "object") return;
			for (var key in attrs) {
				this.attr(key, attrs[key]);
			}
		}
	}),
	
	// copy all attributes of this element into another element
	cloneAttrsInto : function(that) {
		var attrs = this.attrs;
		for (var key in attrs) {
			try {
				that[key] = attrs[key];
				ref.attr(key, attrs[key]);
			} catch (e) {}
		}
	},
	
	
	// Set/get our innerHTML, either to an HTML string, an individual element or a set of elements
	//	Use this in preference to setting innerHTML directly to set up Tags in the contents automatically.
	html : new Property({
		get : function() {
			return this.innerHTML;
		},
		
		set : function(it) {
			if (typeof it === "string") {
				// expand unary tags in the input string
				it = it.expandUnaryTags();
				this.innerHTML = it;
			} else if (typeof it === "number") {
				this.innerHTML = it;
			} else {
				this.innerHTML = "";
				this.append(it);
			}
			Element.initializeElements(this.children);
		}
	}),
	
	//
	//	add outerHTML emulation
	//
	outerHTML : new Property({
		set : function(html) {
			var range = this.ownerDocument.createRange();
			range.setStartBefore(this);
			var df = range.createContextualFragment(html);
			this.parentNode.replaceChild(df, this);
		},
	
		get : function() {
			var clone = this.cloneNode(true);
			clone.innerHTML = this.innerHTML;
			
			// NOTE: this may have problems with TRs or TDs, etc 
			//		 which generate parent context elements (eg: TBODY) automatically.
			var div = document.createElement("div");
			div.appendChild(clone);
			return div.innerHTML;
		}
	}),


	// insert something after another element
	insertAfter : function(toInsert, existing) {
		var next = existing.nextSibling;
		if (next) 	this.insertBefore(toInsert, next);
		else		this.appendChild(toInsert);
		return toInsert;
	},	


	// Append a single element, an ElementList or html to us.
	//	@setupTags false to skip setting up tags in the elements.
	append : function(it, setupTags) {
		if (!it) return this;
		if (typeof it === "string") {	
			it = E.inflate(it);
			if (setupTags !== false) Element.initializeElements(it);
			if (it.length == 1) it = it[0];
		}
		if (typeof it == "string" || typeof it == "number") {
			it = document.createTextNode(it);
		}
		if (it instanceof Element || it instanceof Text)	this.appendChild(it);
		else if (it.length) 		this.appendList(it);
		else						throw "trying to append non-element "+it;
		return it;
	},
	
	appendList : function(list) {
		if (!list || !list.length) return this;
		for (var i = 0, last = list.length; i < last; i++) {
			var it = list[i];
			if (it != null) this.append(it);
		}
		return it;
	},
	
	
	prepend : function(it, setupTags) {
		if (!it) return this;
		if (typeof it === "string") {	
			it = E.inflate(it, false);
//			if (setupTags !== false) Element.initializeElements(it);
		}
		if (it.length)	it.prependList(it);
		else if (it instanceof Element) {
			var prev = this.firstChild;
			(prev ? this.insertBefore(it, prev) : this.appendChild(it));
		} else throw "trying to prepend non-element "+it;
		return it;
	},
	
	prependList : function(list) {
		if (!list || !list.length) return this;
		var prev = this.firstChild;
		for (var i = 0, last = list.length; i < last; i++) {
			prev = (prev ? this.insertBefore(list[i], prev) : this.appendChild(list[i]));
		}
		return it;
	},
	
	
	//
	// List of children which are elements, as an ElementList.
	//	Note:  `element.children`, while similar, doesn't always report children properly!
	//
	elements : new Property({
		get : function() {
			var elements = new ElementList(),
				child = this.firstChild
			;
			while (child) {
				if (child.tagName) elements[elements.length] = child;
				child = child.nextSibling;
			}
			return elements;
		},
	
		set : function(elements) {
			this.html = "";
			if (elements && elements.length) {
				var i = -1, element;
				while (element = elements[++i]) {
					this.append(element);
				}
			}
		}
	}),
	
	
	// empty out all children
	empty : function() {
		this.innerHTML = "";
	},
	
	
	//
	//	Clone a node and add to our parent, immediately after us.  
	//	Use this in preference to the built-in cloneNode.
	//
	//	@deep is true for deep clone (default) or false for shallow clone.
	//	If @autoAdd is true, we will append the cloned node to our parent.
	//
	//	NOTE: breaks node.in*Data link(s) so new node(s) will get new data cache
	//	
	clone : function(deep, autoAdd) {
		if (deep == null) deep = true;
		var it = this.cloneNode(!!deep);
		
		// clear the node.DATA cache from node and all descendants
		it.recurse(function() {
			if (this.hasOwnProperty("dataId")) {
				delete this.dataId;
				if (Element.debugData) this.removeAttribute("_dataId");
			}
		});
		// initialize the element and its children up as tags
		Element.initializeElement(it);
		
		if (autoAdd === true) this.parentNode.appendChild(it);
		return it;
	},
	
	
	// Do something on yourself and all of your element children.
	//	@method is a function or name of a method on each element to call.
	//	@this in the method will be the element
	//	@args is optional array of arguments
//TODO: this seems wrong -- shouldn't we tell the kids to recurse with the same arguments?
	recurse : function(method, scope, args) {
		if (typeof method === "function") {
			method.apply(scope||this, args);
		} else {
			if (typeof this[method] === "function") this[method].apply(scope||this, argument);
		}
		var kids = this.elements;
		if (kids.length) {
			kids.forEach(function(kid) {
				kid.recurse(method, scope, args);
			});
		}
	},
	
	
//
//	Get HTML to save for this element.
//
//	Default is just to return the element's outerHTML, but you can override if you want.
//
	
	// list of attribute names to output FIRST, IN THIS ORDER when saving
	saveAttrOrder : null,
	
	// map of attrName => output method for saving
	//	if method is a function, we'll call that function as 	element[func](attrValue)
	//	if method is null or returns null, we'll skip this attribute
	saveAttrMap : null,
	
	// if true, we save whitespace when saving
	//	if false, whitespace is skipped
	saveWhiteSpace : true,
	
	// return the HTML we should use to save this element
	getSaveHTML : function(orderedAttrs, skipAttrs) {
		var tagName = this.tagName.toLowerCase();
		
		// short circuit for simple elements
		if (this.attributes.length === 0 && this.childNodes.length == 0) {
			return "<"+tagName+"/>";
		}
	
		// output the start tag
		var startTag = ["<"+tagName], endTag;
		var orderedAttrs = this.saveAttrOrder;
		var saveAttrMap = this.saveAttrMap || {};
		if (this.attributes.length) {
			if (orderedAttrs) {
				orderedAttrs.forEach(function(name) {
					var value = (this.attributes[name] ? this.attributes[name].nodeValue : null);
					if (saveAttrMap[name]) {
						if (saveAttrMap[name] == null) return;
						value = saveAttrMap[name].apply(this, [value]);
					}
					if (value != null) startTag.push(name + '="' + value + '"');
				}, this);
			}
			var i = -1, attr, name, attributes = this.attributes;
			while (attr = attributes[++i]) {
				name = attr.nodeName;
				value = attr.nodeValue;
				
				// skip derived attributes
				if (name.charAt(0) === "_") continue;
				if (orderedAttrs && orderedAttrs.contains(name)) continue;
				if (saveAttrMap[name]) {
					if (saveAttrMap[name] == null) continue;
					value = saveAttrMap[name].apply(this, [value]);
				}
				startTag.push(name + '="' + value + '"');
			}
		}

		// get HTML for our children		
		var childHTML = this.getChildrenSaveHTML();

		// output end tag or unary tag end
		if (childHTML.length === 0) {
			startTag.push("/>");
			endTag = "";
		} else {
			startTag.push(">");
			endTag = "</"+tagName+">";
		}
		return startTag.join(" ") + childHTML + endTag;
	},

	getChildrenSaveHTML : function() {
		// output children in a sub-array
		var children = [], i = -1, child;
		while ((child = this.childNodes[++i]) != null) {
			switch(child.nodeType) {
				// element
				case 1:		children.push(child.getSaveHTML()); break;
				// text node
				case 3:		// whitespace check
							if (!this.saveWhiteSpace && /^\s+$/.test(child.nodeValue)) break;
							children.push(child.nodeValue); break;
				// comment
				case 8:		children.push("<!--"+child.value+"-->"); break;
			}
		}
		return children.join("");
	},

	
});// end extendIf




//
//	updaters:  add elements to be updated automatically			TODOC
//
EP.extend({
	// process a single update string, adding it to our updaters list
	addUpdater : function(element, updateString) {
		if (!element || !updateString) return;	//TOTHROW

//console.warn(this,"adding updater ",element,"to",this,"\n",updateString);
		updateString = updateString.tupelize();

		var updaters = this.DATA.updaters || (this.DATA.updaters = []);
		for (var what in updateString) {
			var expression = updateString[what];
			if (!expression) {
				expression = what;
				what = "html";
			}
			var updater = {what:what, expression:expression, element:element, type:"property"};
			var start = what.charAt(0);
			if (start === "@" || start === ".") {
				updater.what = updater.what.substr(1);
				updater.type = (start === "@" ? "attribute" : "style");
			}
			updaters.push(updater);
		}
		if (!this.unloadMap.updaters) this.unloadMap = "updaters:_clearUpdaters";
		return element;
	},

	// clear the updaters references (called automatically during onUnload)
	_unloadUpdaters : function(updaters, data) {
		if (hope.debug.unload) console.warn("unloading updaters for ",this);
		var i = -1, it;
		while (it = updaters[++i]) {
			it.element = null;
			updaters[i] = null;
		}
		data.updaters = null;
	},

	update : function() {
		var updaters = this.DATA.updaters;
		if (!updaters) return;
		var i = -1, updater;
		while (updater = updaters[++i]) {
			var element = updater.element,
				what = updater.what,
				value = hope.get(this, updater.expression)
			;
			if (value == null) value = "";		//TODO -- always do this?
			switch (updater.type) {
				case "attribute":	element.attr(what, value); break;
				case "style":		element.style[what] = value; break;
				default:			element[what] = value;
			}
		}
	}
});



//
//	parts:  Sub-parts we manage automatically.
//			When initializing an element, we pull all visible descendants with a @part
//			and install them as 
//
EP.extend({
	addPart : function(part, partName) {
		if (!part || !partName) return;		//TOTHROW
		var parts = this.DATA.parts || (this.DATA.parts = {});
//console.warn(this,"adding part ",partName,"to",part);
		this[partName] = parts[partName] = part;
		part.owner = this;
		if (!this.unloadMap.parts) this.unloadMap = "parts:_unloadParts";
	},
	
	removePart : function(part, partName) {
		delete this[partName];
		delete part.owner;
	},
	
	_unloadParts : function(parts, data) {
//console.warn("unloading parts for",this);
		for (var name in parts) {
			var part = this[name];
			if (part) {
				part.owner = null;
				parts[name] = this[name] = null;
			}
		}
		data.parts = null;
	}
});

//
//	Subclassing Elements: create subclasses for elements to add custom functionality
//		- create the subclass via:   
//			Element.Subclass("hope.SomeName", { tag:"sometag", properties:{...} });
//
//		- create instances by:
//			new hope.SomeName();
//
//		- if you want to create an instance but NOT initialize it, do
//			new hope.SomeName(false);
//
//		- elements with tag name "sometag" will morphed into instance of the class
//			when Element.initialize() is called on them or on their parent
//

hope.extend(E, {
	// Create a new Element type, with hookup behaviors and all.
	//	NOTE: we're actually creating a subclass of the "Element" base class.
	Subclass : function(id, options) {
		return new hope.Element.Subclass(id, options);
	},

	// map of tag => element subclass constructor
	TagMap : {},

	// map of selector => element subclass constructor, 
	//	for subclasses which have a more specific selector to match
	// NOTE: you can only have one tag per selector, and we'll take the first one we find!
	SelectorMap : {},

	
	// Find the adapter function we should use to adapt a pre-existing @element.
	// Returns null if an adapter can't be found, or if already adapted.
	getAdapterFor : function (element) {
		var tag = element.tagName;	//NOTE: dependent on tag names ALWAYS being reported upper case!
//		if (!_TagMap[tag]) return;

		// first check to see if there's a specific selector (eg:  "tag[attribute]")
		if (_SelectorMap[tag]) {
			for (var selector in _SelectorMap[tag]) {
				if (element.matches(selector)) return _SelectorMap[tag][selector];
			}
		}
		// if we get here there's only a single constructor for this tag
		return _TagMap[tag];
	}
});

var _TagMap = E.TagMap,
	_SelectorMap = E.SelectorMap
;

// HMMM, should this be hope-element?
new Class("hope.Element", {
	tag : "hope-element",
	prototype :document.createElement("hope-element").attr("prototype","yes")._setUpData(),

	makeSubclassConstructor : function(id, options) {
		var superClass = options["super"];
		if (!options.tag) {
			if (superClass && superClass.tag && options.selector) {
				options.tag = superClass.tag;
			} else {
				options.tag = id.toIdentifier().replace("$","").toLowerCase();
			}
		}
		var tag = options.tag;
		if (!tag) throw "You must provide a tag for your element subclass "+id;
		
		// create the constructor function in an eval so we can see it in firebug
		var constructor;
		eval("constructor = function "+id.toIdentifier()+"(properties) {\n\
				var element = document.createElement('"+tag+"');\n\
				if (properties !== false) {\n\
					Element.initializeElement(element, properties);\n\
				}\n\
				return element;\n\
			 }");
		if (options.template) constructor.template = options.template;
		constructor.tag = tag;

		// element.tagNames are always reported in upper case
		tag = tag.toUpperCase();
		var selector = options.selector;
		
		if (!selector && _TagMap[tag]) {
			throw "You can't define two Element subclasses with the tag "+tag;
		} else if (selector) {
			_SelectorMap[tag] = _SelectorMap[tag] || {};
			if (_SelectorMap[tag][selector]) {
				throw "You can't define two Element subclasses with the selector "+selector;
			}
			_SelectorMap[tag][selector] = constructor;
		} else {
			_TagMap[tag] = constructor;
		}
		
		// if options.itemContainer is defined, that's a global pointer to the container
		//	for ALL items.  You'll generally use this with singleton objects.
		// You can pass a string as the itemContainer and we'll dereference it the first time
		//	you look it up.  Note that this could lead to race conditions.
		if (options.itemContainer) {
			var itemContainer = options.itemContainer;
			hope.defineGetter(constructor, "itemContainer", function() {
				if (typeof itemContainer === "string") itemContainer = select(itemContainer);
				return itemContainer;
			});
		}
		
		// if options.itemSelector is defined, that allows us to:
		//
		//	1) find an instance of the tag by calling 
		//			ElementClass.getInstance({props})
		//
		//	2) create/find a singleton instance by calling 
		//			ElementClass.create({props})
		//	
		if (options.itemSelector) {
			var itemSelector = constructor.itemSelector = options.itemSelector;
			var subMatches = itemSelector.match(/{{(.*?)}}/g);
			
			// return the first instance we find that matches the global itemSelector
			constructor.getInstance = function(props) {
				var container = this.itemContainer || document,
					selector = itemSelector
				;
				if (typeof props === "string") {
					var last = Math.min(arguments.length, subMatches.length);
					for (var i = 0; i < last; i++) {
						selector = selector.replace(subMatches[i] || "{{xxx}}", arguments[i]);
					}
				} else {
					selector = selector.expand(props);
				}
				return container.getChild(selector);
			}

			// return all instances we find that match the global itemSelector, 
			//		expanded through properties passed in
			// pass null props to select all on the page/in the itemContainer
			constructor.getInstances = function(props) {
				var container = this.itemContainer || document;
				if (props == null) {
					return container.getChildren(this.tag);
				}
				var	selector = itemSelector;
				if (typeof props === "string") {
					var last = Math.min(arguments.length, subMatches.length);
					for (var i = 0; i < last; i++) {
						selector = selector.replace(subMatches[i] || "{{xxx}}", arguments[i]);
					}
				} else {
					selector = selector.expand(props);
				}
				return container.getChildren(selector);
			}
			
			// either:
			//	- return the first instance of which matches {props}, or
			//	- create one with {props}
			// if we have an 'itemContainer' defined, will append to that automatically.
			constructor.create = function(props) {
				var it = this.getInstance(props);
				if (!it) {
					it = new this(props);
					if (this.itemContainer) {
						this.itemContainer.append(it);
						this.itemContainer.append("\n\n");
					}
				}
				return it;
			}
		}
		
		return constructor;
	},
	
	makeSubclassPrototype : function(id, options) {
		var superProto = options["super"].prototype;
		var proto = document.createElement(options.tag).attr("prototype","yes");
		// NOTE: this MUST occur BEFORE _setUpData
		hope.setProto(proto, superProto);

		// set 'adapter' since Safari won't allow you to reassign the 'constructor' for an element
		proto._adapter = options.constructor;
		proto._setUpData();
		
		proto.initialized = true;
		return (options.prototype = proto);
	},
	
	"static" : {
		// default tag
		tag : "hope-element",

		// if true, we recurse to `adapt()` child elements when we're being `adapt()`ed
		adaptChildren : true,
		
		// destroy this class on window unload
		onUnload : function() {
			this.prototype._attributeMap = null;			// probably not necessary
			this.prototype._childProcessors = null;			// probably not necessary
			this.prototype._listeners = null;				// probably not necessary
			this.prototype._adapter = null;
			Class.onUnload.call(this);
		}
	}
});// end new Class("hope.Element")


// NOTE: HACK:  Firefox has trouble processing elements with custom constructors
//				(like HTMLMenuElement) if hope.Element.prototype hasn't been fully set up.
//				Checking its Object.keys() seems to fix this.  Not sure why.
if (Browser.gecko) {
	var keys = Object.keys(hope.Element.prototype);
}




Script.loaded("{{hope}}Element.js");
});// end Script.require()
