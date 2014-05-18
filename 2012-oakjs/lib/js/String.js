/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//	String instance extensions
//	==========================
//  NOTE: if these functions are already present on string, we will **not** override them.
Module.define("oak/lib/js/String",
"oak/lib/js/Object,oak/lib/core/Property",
function(Object, Property) {
	Property.patch(String.prototype, {

		//
		trim : function() {
			return this.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
		},


		// Trim and split by one or more spaces.
		// If an empty string, we'll return an empty array.
		splitBySpaces : function() {
			return  this.trim()
						.split(this.SPACE_SPLITTER)
						.filter(function(it){return !!it});
		},
		SPACE_SPLITTER : /\s+/,

		// Trim and split by commas, optionally surrounded by spaces.
		// If an empty string, we'll return an empty array.
		splitByCommas : function() {
			return  this.trim()
						.split(this.COMMA_SPLITTER)
						.filter(function(it){return !!it});
		},
		COMMA_SPLITTER : /\s*,\s*/,

		// Trim and split by line breaks.
		// If an empty string, we'll return an empty array.
		splitByLines : function() {
			return 	this.trim()
						.split(this.LINE_SPLITTER)
						.filter(function(it){return !!it});
		},
		LINE_SPLITTER : /\s*\n\s*/,


		// defer <img src=''> loading in a string
		deferImgStr : function() {
			return this.replaceAll(/<img ([^<]*?)src=["'](.*?)["']([^<])*?>/i, "<img $1defer-src=\"$2\"$3>");
		},


		// Replace all occurances of `match` with the `replacement`.
		// If `match` is a string, this is a straightforward substitution.
		// If `match` is a regular expression, this will convert each instance of `match` into `replacement`
		//		according to regular expresion `replace()` semantics.
		//	NOTE: in this case, you DO NOT want to make your match expression use the "global" (//g) syntax.
		replaceAll : function(match, replacement) {
			if (typeof match === "string") {
				return this.split(match).join(replacement);
			} else if (match instanceof RegExp) {
				var output = [], index, lastIndex = 0;
				var string = this;
				while ((index = string.search(match)) > -1) {
					output.append(string.substr(0, index));
					string = string.substr(index);
					var matchText = string.match(match);
					string = string.substr(matchText[0].length);
					var replacementText = matchText[0].replace(match, replacement)
					output.append(replacementText);
				}
				output.append(string);
				return output.join("");
			}
		},

		contains : function(match) {
			return this.indexOf(match) > -1;
		},

		startsWith : function(match) {
			return this.indexOf(match) === 0;
		},

		endsWith : function(match) {
			if (typeof match !== "string") return false;
			if (match === "") return true;
			return this.substr(match.length * -1) === match;
		},


		// eg: CSS style:  tupelize(";", ":")
		// eg: `"a:1;b:1,2,3"` => `{a:"1", b:"1,2,3"}`
		tupelize : function(itemDelimiter, tupleDelimiter) {
			var result = {};
			if (!itemDelimiter) itemDelimiter = ";";
			if (!tupleDelimiter) tupleDelimiter = ":";
			var tuples = this.split(itemDelimiter);
			tuples.forEach(function(tuple) {
				var split = tuple.split(tupleDelimiter);
				result[split[0]] = split[1];
			});
			return result;
		},

		// Convert a CSS style string to an object.
		// If you pass an object, we'll add to that.  Otherwise we'll make a new one.
		NUMERIC_STYLE_KEYS : ["left","top","width","height","right","bottom"],
		styleToObject : function(object) {
			if (!object) object = {};
			var styles = this.trim().tupelize(/\s*;\s*/g, /\s*:\s*/g), key, value;
			for (key in styles) {
				if (! (key = key.trim())) continue;

				value = styles[key];
				if (this.NUMERIC_STYLE_KEYS.contains(key) && !value.contains("%")) value = parseInt(value);
				object[key] = value;
			};
			return object;
		},

		plurals : {},
		pluralize : function() {
			if (this.plurals[this]) return this.plurals[this];
	// TODO: add other clever rules here
			return this + "s";
		},
		addPlural : function(singular, plural) {
			this.plurals[singular] = plural;
		},

//NOTE: THIS IS INCORRECT -- IT MATCHES ANY XML ENTITY
//		AMPERSAND_PATTERN : /&(?!#?[a-z0-9]{2,6};)/g,
		AMPERSAND_PATTERN : /&/g,
		LESS_THAN_PATTERN : /</g,
		GREATER_THAN_PATTERN : />/g,
		QUOTE_PATTERN : /"/g,
		escapeHTML : function() {
			html = this.replace(this.AMPERSAND_PATTERN, "&amp;")
					   .replace(this.LESS_THAN_PATTERN, "&lt;")
					   .replace(this.GREATER_THAN_PATTERN, "&gt;")
					   .replace(this.QUOTE_PATTERN, "&quot;");
	//		console.info(html);
			return html;
		},

		unescapeHTML : function() {
			return $("<div>"+this+"</div>").html()
						.split("&amp;").join("&")
						.split("&#38;").join("&")
						.split("&lt;").join("<")
						.split("&gt;").join(">");
		},

		// Return this string properly escaped to be in an HTML attribute value.
// TODO: escaping for XML???
		escapeHTMLAttributeValue : function() {
			value = this.replace(this.AMPERSAND_PATTERN, "&amp;")
					    .replace(this.QUOTE_PATTERN, "&quot;");
	//		console.info(value);
			return value;
		},


		HTML_PATTERN : /<(.*?)>/g,
		stripHTML : function(){
			html = this.replace(this.HTML_PATTERN, "");
			return html;
		},

		// replace unary tags with binary tags since some browsers don't like unknown unary tags
		//	eg:   <foo><bar/></foo>  =>  <foo><bar></bar></foo>
		UNARY_TAG_PATTERN : /<([^! \/>]+)([^>]*?)?\/>/g,
		DASHED_TAG_NAME_PATTERN : /<(\/?)(\w+)-(\w+)([ >])/g,
		expandUnaryTags : function() {
			return this.replace(this.UNARY_TAG_PATTERN, "<$1$2></$1>");
	//				   .replace(this.DASHED_TAG_NAME_PATTERN, "<$1$2$3$4");
		},

		// Add a query parameter to the end of a url string.
		addQueryParam : function(name, value, shouldEscape) {
			if (!name) return ""+this;
			if (shouldEscape)	return this + (this.contains("?") ? "&" : "?") + (''+name).escape() + "=" + (''+value).escape();
			else				return this + (this.contains("?") ? "&" : "?") + name + "=" + value;
		},

		// Add a key/value map of query parameters after the string.
		addQueryParams : function(map, shouldEscape) {
			if (!map) return ""+this;
			var string = this;
			for (key in map) {
				string = string.addQueryParam(key, map[key], shouldEscape);
			}
			return string;
		},

		// Add a query parameter, but ONLY if the value is not null or the empty string
		addNonEmptyQueryParam : function(name, value) {
			if (value == null || value === "") return this;
			return this.addQueryParam(name, value);
		},

		// syntactic sugar
		escape : function() {
			return encodeURIComponent(this);
		},

		// syntactic sugar
		unescape : function() {
			return decodeURIComponent(this);
		},

		// repeat this string N times
		times : function(count) {
			var output = [];
			while (count-- > 0) {
				output[output.length] = this;
			}
			return output.join("");
		},

		// Expand some HTML given a scope object
		//	eg:		"abc{{foo}}def".expand({foo:"BAR"}) =>  "abcBARdef"
		//  eg:		"abc{{foo.bar}}def".expand({foo:{bar:"BAR"}}) => "abcBARdef"
		//	eg:		"abc{{this}}def".expand({}) => "abc[Object object]def"
		//			NOTE: the {{this}} form is useful if your object has a meaningful "toString" method.
		//
		// If you have a global "Messages" object defined, we'll expand those values automatically when we see "[[]]":
		// 	eg:		"abc[[messageName]]def".expand()			=>  "abcMESSAGE TEXTdef" (assuming Messages.messageName === "MESSAGE TEXT")
		// 	eg:		"abc[[dotted.message.name]]def".expand()	=>  "abcMESSAGE TEXTdef" (assuming Messages.dotted.message.name === "MESSAGE TEXT")
		_TEMPLATE_PATTERN : Property.Constant(/\{\{([^}]*)\}\}/),
		_MESSAGES_PATTERN : Property.Constant(/\[\[([^\]]*)\]\]/),
		expand : function(scope) {
			var value = this;
			// do message dictionary bits FIRST, as they may have scope substitutions in them
			if (this.contains("[[")) value = value._replaceFromScope(window.Messages, this._MESSAGES_PATTERN);
			// now do scope subs
			if (this.contains("{{")) value = value._replaceFromScope(scope, this._TEMPLATE_PATTERN);
			return ""+value;
		},
		_replaceFromScope : Property.Hidden(function(scope, pattern) {
			if (!scope) scope = {};
			var matches = this.split(pattern);
			// yields:  ["string", "<match_string>", "string", "<match_string>", "string"]
			for (var i = 1, last = matches.length, token, replacement; i < last; i+=2) {
				token = matches[i];
				replacement = null;

				// If token has a "?", it's a ternary expression (eg: for pluralization).
				if (token.contains("?")) {
					// Split the token up into:  `"expression"` and `["truthy value", "falsy value"]`,
					// We generally separate values by colon,
					// but if you want a colon in the output you can use a pipe char instead.
					var expression = token.substr(0, token.indexOf("?"));
					var values = token.substr(expression.length+1);
					if (values.contains("|")) 	values = values.split("|");
					else						values = values.split(":");
//console.warn(expression, values);
					// Good 'ol eval, it's our friend.
					// NOTE: if the eval excepts, we default to the second (falsy) value.
					var result = false;
					try {
						with (scope) {
							result = eval(expression);
						}
					} catch (e) {}
					replacement = (!!result ? values[0] : values[1]);
				}
				// if we have parens, it's a function call -- do an eval().
				else if (token.contains("(")) {
					try {
						with (scope) {
							replacement = eval(token);
						}
					} catch (e) {}
				}
				// nested.reference.inside.scope
				else if (token.contains(".")) {
					var tokens = token.split(".");
					var nested = scope;
					while (token = tokens.shift()) {
						nested = nested[token];
						if (nested == null) break;
					}
					replacement = nested;
				}
				// reference to the scope itself
				else if (token === "this") {
					token = ""+scope;
				}
				// normal case
				else {
					replacement = scope[token];
				}
				matches[i] = (replacement == null ? "" : replacement);
			}
			return matches.join("");
		}),

		// Capitalize the first letter of this string.  Does NOT work with HTML.
		capitalize : function() {
			return this.charAt(0).toUpperCase() + this.substr(1);
		},

		// Capitalize the first letter of each word of this string.  Does NOT work with HTML.
		capitalizeWords : function() {
			return this.split(/\s+/g).map(function(word){return word.toLowerCase().capitalize()}).join(" ");
		},

		// Convert "camelCaseForm" to "hyphenated-form"
		hyphenate : function() {
			return this.replace(/[A-Z]/g,function(match,letter){return "-"+letter.toLowerCase();});
		},

		// convert "hyphenated-form" or "spacerized form" to "camelCaseForm"
		camelize : function(upperCaseFirstLetter) {
			var camel = this.replace(/[- ](.)/g, function(match, letter){return letter.toUpperCase();});
			if (upperCaseFirstLetter) camel = camel[0].toUpperCase() + camel.substr(1);
			return camel;
		},

		// convert "camelCaseForm" and/or "Underscored_or-dashed-form" to "Spaced Form"
		spacerize :function() {
			return this.replace(/[-_]+/g," ")
					   .replace(/([A-Z0-9]+[a-z]+)\s*/g,"$1 ")
					   .trim();
		},


		// Convert this string to a legal JS identifier.
		// By default, we'll replace non-legal chars with "_";
		//	pass a string `nonLegalReplacementChar` to use some other replacement char.
		// Pass `allowHypens==true` to allow hyphens in the name.
		//
		// NOTE: you can pass the empty string as the `nonLegalReplacementChar` to just eat non-legal chars.
		//
		toIdentifier : function(nonLegalReplacementChar, skipNumberPrefix, allowHyphens) {
			if (nonLegalReplacementChar == null) nonLegalReplacementChar = "_";
			// replace all non-identifier chars with the replacementChar
			var pattern = (allowHyphens ? /[^\w\d_\-$]/g : /[^\w\d_$]/g);
			var identifier = this.trim().replace(pattern, nonLegalReplacementChar);
			// identifiers can't start with a number, so prepend with an "_" if necessary.
			if (identifier.length && identifier[0].match(/^\d/) && !!skipNumberPrefix) identifier = "_" + identifier;
			return identifier;
		},


		// Convert rgb[a] color string to its hex equivalent.
		// If you give it a hex color, it will return the hex color.
		// Special cases "transparent" if string is rgba(*,*,*,255).
		//
		// NOTE: this will accept an "rgba" string, but will drop the alpha component.
		RGB_PATTERN : /rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*(\d*)\)/,
		HEX_PATTERN : /^#?([0-9a-f]{2}|[0-9a-f]{1})([0-9a-f]{2}|[0-9a-f]{1})([0-9a-f]{2}|[0-9a-f]{1})$/i,
		rgbToHex : function() {
			if (this.match(this.HEX_PATTERN) || this.toLowerCase() == "transparent") return ""+this;
			var rgba = this.match(this.RGB_PATTERN);
			if (!rgba) return "";
			if (rgba[4] == "255") return "transparent";
			var hex = "#"
					+ ("0" + parseInt(rgba[1],10).toString(16)).slice(-2)
					+ ("0" + parseInt(rgba[2],10).toString(16)).slice(-2)
					+ ("0" + parseInt(rgba[3],10).toString(16)).slice(-2);
			hex = hex.toUpperCase();	// AS GOD INTENDED
			return hex;
		},

		// Convert hex color string to its rgba equivalent.
		hexToRGB : function () {
			if (this.match(this.RGB_PATTERN)) return this;
			if (this.toLowerCase() == "transparent") return "rgba(0,0,0,255)";

			// trim and strip off the "#"
			var hex = this.match(this.HEX_PATTERN);
			if (!hex) return "";
			var r = parseInt(hex[1], 16);
			var g = parseInt(hex[2], 16);
			var b = parseInt(hex[3], 16);
			return "rgb("+r+","+g+","+b+")";
		}
	});


// Static methods callable on `String`
//	==========================
	Property.extend(String, {
		// sort an array of strings in a case INsensitive manner
		sortStringArray : function(array) {
			if (!array || typeof array.sort !== "function") {
				console.warn("String.sortStringArray(",array,"): error, array has no 'sort' method");
			}
			array.sort(function(a,b) {
				if (typeof a === "string") a = a.toLowerCase();
				if (typeof b === "string") b = b.toLowerCase();
				if (a == b) return 0;
				if (a < b) return -1;
				return 1;
			});

			return array;
		},

		// Given a tagName, an (optional) attributes map and some inner XML content,
		//	return properly formatted XML.
		// NOTE: this will automatically properly escape the attribute values for you.
		// NOTE: this assumes that your innerXML is already properly formatted.
		// NOTE: if you don't pass any innerXML, you'll get a unary tag.
		getXML : function(tagName, attributes, innerXML) {
			return this.getIndentedXML("", tagName, attributes, innerXML);
		},

		getIndentedXML : function(indent, tagName, attributes, innerXML) {
			var makeBinaryTag = !!innerXML;
			if (makeBinaryTag) {
				return indent + String.startTag(tagName, attributes)
						+ indent + "\t" + innerXML
					 + indent + String.endTag(tagName);
			} else {
				return indent + String.unaryTag(tagName, attributes);
			}
		},

		// Given a single value to output as an attribute, convert to a string.
		// NOTE: `Null` will be returned as the empty string.
		// NOTE: You can pass a `formatter` which will transform the value (eg: convert a date intelligently, etc).
		//		 Default is to just do a toString() on the value.
		attributeValueToHTMLString : function(value, formatter) {
			if (value == null) return "";
			if (formatter) {
				formatter = formatter.toLowerCase();
				switch (formatter) {
					case "isodate"	:	if (value.toISO) 	 value = value.toISO(); break;
					case "floatdate":	if (value.toFloat) value = value.toFloat(); break;
				}
			}
			return (""+value).escapeHTMLAttributeValue();
		},

		// Return an HTML-friendly `key='value'` string for a set of `attributes`.
		// If you pass an `outputOrder` array of strings, or attributes is an OrderedMap,
		//	we'll output those attrs first, then the rest in random order.
		// Otherwise we'll output the attributes in random order.
		//  Pass `true` to skipUnknown to get JUST the attributes defined in outputOrder
		//	 (only applies if outputOrder is specified).
		htmlAttributesToString : function(attributes, outputOrder, skipUnknown, attrDelimiter) {
			if (!attributes) return "";
			if (typeof attributes === "string") return attribtues;

			var output = [], i = -1, attr, value;

			// if our attributes object has a KEYS value (eg: is an OrderedMap),
			//	use that as our outputOrder;
			if (!outputOrder && attributes.KEYS) outputOrder = attributes.KEYS;

			// if we have a specific order to output in, do all of those attributes first
			if (outputOrder) {
				// clone the attributes so we can remove items we've already handled
				attributes = Property.extend({}, attributes);
				while (key = outputOrder[++i]) {
					value = String.attributeValueToHTMLString(attributes[key]);
					output.push( key + '="' + value + '"' );
					delete attributes[key];
				}
			}

			// output other attributes in random order, unless skipUnknown is true.
			if (!skipUnknown) {
				for (var key in attributes) {
					value = String.attributeValueToHTMLString(attributes[key]);
					output.push( key + '="' + value + '"' );
				}
			}

			if (!attrDelimiter) attrDelimiter = " ";
			return output.join(attrDelimiter);
		},

		// outputOrder is an optional list of attributes names:
		//	If you pass it, we'll output those attributes first, in that order,
		//		then all other attributes in random order.
		//	If you don't pass it, you'll get all attributes, in random order.
		//  Pass `true` to skipUnknown to get JUST the attributes defined in outputOrder
		//	 (only applies if outputOrder is specified).
		startTag : function(tagName, attributes, outputOrder, skipUnknown) {
			attributes = String.htmlAttributesToString(attributes, outputOrder, skipUnknown);
			// add a space between tag name and attributes
			if (attributes) attributes = " " + attributes;
			return "<"+tagName + attributes + ">";
		},

		// outputOrder is an optional list of attributes names:
		//	If you pass it, we'll output those attributes first, in that order,
		//		then all other attributes in random order.
		//	If you don't pass it, you'll get all attributes, in random order.
		//  Pass `true` to skipUnknown to get JUST the attributes defined in outputOrder
		//	 (only applies if outputOrder is specified).
		unaryTag : function(tagName, attributes, outputOrder, skipUnknown, attrDelimiter) {
			if (!attrDelimiter) attrDelimiter = " ";
			attributes = String.htmlAttributesToString(attributes, outputOrder, skipUnknown, attrDelimiter);
			// add a space between tag name and attributes
			if (attributes) attributes = attrDelimiter + attributes + (attributes.contains("\n") ? "\n" : "");
			return "<"+tagName + attributes + "/>";
		},

		endTag : function(tagName) {
			return "</" + tagName + ">";
		},


		// Convert a map to CSS style attributes.
		// NOTE: does NOT do any key camel-case swizzling...
		getStyleAttributeString : function(map) {
			var output = [];
			for (var key in map) {
				output.push(key+":"+map[key]);
			}
			return output.join(";");
		},


		// Convert an object of key/value pairs to a URL parameter string.
		getUrlParameters : function(object) {
			var output = [];
			if (object) {
				for (var key in object) {
					var value = object[key];
					var encodedValue = (value == null ? "" : (""+value).escape());
					output.append((""+key).escape() + "=" + encodedValue);
				}
			}
			return output.join("&");
		},


		// Join two paths.
		// If the "suffix" starts with "http", assume it's actually a full path and just return that.
		// Otherwise replace the first occurance of `identifer` with suffix.
		//	eg:    mergePaths("http://foo/{bar}/baz", "{bar}", "bonk")			=>   http://foo/bonk/baz
		//	eg:    mergePaths("http://foo/{bar}/baz", "{bar}", "http://bonk")	=>   http://bonk
		mungePaths : function(path, identifier, suffix) {
			if (!suffix) suffix = "";
			if (!path || suffix.startsWith("http")) return suffix;
			return path.replace(identifier, suffix);
		},

		// Given two strings, return the minimum string common to both, starting at the beginning.
		// if `trim` is true, we'll trim whitespace and punctuation characters `.,-_;:?` at the end.
		COMMON_TRIM_PATTERN : /[\.,\-_;:\? \t\n]/,
		getCommonString : function(stringA, stringB, trim) {
			var common;
			if (stringA === stringB) {
				common = stringA;
			} else {
				var minLength = Math.min(stringA.length, stringB.length);
				var lastCommonChar = -1;
				while (lastCommonChar++ < minLength) {
					if (stringA[lastCommonChar] != stringB[lastCommonChar]) break;
				}
				common = stringA.substr(0, lastCommonChar);
			}
			if (trim) {
				while (String.COMMON_TRIM_PATTERN.test(common[common.length-1])) {
					common = common.substr(0, common.length-1);
				}
			}
			return common;
		}
	});

	return String;
});	// end define("oak/lib/js/String")
