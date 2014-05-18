/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

////////////////
//
// Attribute properties -- looks in self.attributes for a property of the given name/type.
//	If no value specified in attributes, or value is not valid for its type, will return defaultValue.
//
//	NOTE: there are a number of variants which will do strong type coercion for you.
//
//	NOTE: we assume that all of the attributes we're dealing with are in lower case,
//			which works well with XML input/output.
//
////////////////
Module.define("oak/lib/core/Property-Attribute",
"oak/lib/core/Property",
function(Property) {

	////////////////
	//
	//  Create an Attribute with options object passed in.
	//
	//	NOTE: this has a different signature than, eg, Property.StringAttribute, etc which are easier to set up.
	//
	//	`options` are any of:
	//		- `type`			OPTIONAL  : Logical data type (for debugging).
	//
	//		- `property`		MANDATORY : Name of property to get()/set().
	//										NOTE: you generally want to use lowercase property names,
	//										especially if you're using $().orderedAttrs() to get
	//										attributes originally, as browsers can mangle attribute case.
	//
	//		- `defaultValue`	OPTIONAL  : Default value to return on get() if current value is null or undefined.
	//										If a function, we'll call that function on `this` when looking up the value.
	//
	//		- `useDefaultFor`	OPTIONAL  : Array of values which will also result in the defaultValue being returned.
	//										e.g. for StringAttributes, an attribute value of "" will return the default.
	//
	//		- `getter`			OPTIONAL  : Transform function for get(), as:
	//											`setter(value, thing, options)`
	//												- `value` 	is current value of the attribute
	//												- `thing` 	is the thing we're getting the value from
	//												- `options`	is this options object.
	//										Should return coerced value or null if value won't coerce properly.
	//
	//		- `setter`			OPTIONAL  : Transform function for set(), as:
	//											`setter(value, thing, options)`
	//												- `value` 	is current value of the attribute
	//												- `thing` 	is the thing we're getting the value from
	//												- `options`	is this options object.
	//										Should return coerced value to save (generally a string)
	//										or null if value won't coerce properly.
	//
	//		- `readOnly`		OPTIONAL  : Set to `true` if you shouldn't be able to assign to this property.
	//										NOTE: you can still set the value by setting `this.attributes.xxx = y`
	//
	//	`additionalOptions` is another object with the same signature as above
	//						this allows you to add additional options in the normal calling form, eg:
	//							Property.StringAttribute("foo", "someDefault", { getter:... })
	////////////////
	function AttributeFactory(options, additionalOptions) {
		if (!options) 			throw "AttributeFactory(): must pass in options";
		if (!options.property) 	throw "AttributeFactory(): must pass in options.property";

		if (additionalOptions) {
			for (var key in additionalOptions) options[key] = additionalOptions[key];
		}

		return new Property({
			// Return an attribute value of some object, or options.defaultValue if value is null.
			get : function _getAttribute() {
					var value;
					if (this && this.attributes) value = this.attributes[options.property];
					if (options.getter) value = options.getter.call(this, value, this, options);
					if (value == null || (options.useDefaultFor && options.useDefaultFor.contains(value))) {
						if (typeof options.defaultValue === "function") value = options.defaultValue.apply(this, [value]);
						else											value = options.defaultValue;
					}
					return value;
				},

			// Set an attribute value of some object.
			//  If the value is null, we'll clear the attribute value set on the object.
			//  Returns the converted value.
			set : function _setAttribute(value) {
				if (options.readOnly) return;

				// normalize through our "setter".
				// this will convert invalid values to undefined.
				if (options.setter) value = options.setter(value, this, options);
				var property = options.property;
				if (this.setAttribute) {
					this.setAttribute(property, value);
				} else {
					// default attributes if not defined yet.
					var attrs = (this.attributes || (this.attributes = {}));
					// handle OrderedMaps as attributes, see "oak/lib/core/OrderedMap" and "oak/lib/jquery/jquery.extensions:orderedAttrs()".
					if (attrs.addProperty) {
						if (value == null) 	attrs.removeProperty(property);
						else				attrs.addProperty(property, value)
					}
					// handle pojos (plain ol' javascript objects)
					else {
						if (value == null)	delete attrs[property];
						else				attrs[property] = value;
					}
				}
				if (options.onChange) options.onChange.apply(this, [value]);
				if (options.dirtyOnChange) this.dirty();
				return value;
			}
		});
	}



	////////////////
	//
	//  Attribute with no type coercion.
	//
	////////////////
	Property.Attribute = function Property_Attribute(property, defaultValue, additionalOptions) {
		return AttributeFactory({
			type			: 'none',
			property		: property,
			defaultValue	: defaultValue
		}, additionalOptions);
	}


	////////////////
	//
	//	String attribute.
	// 	Note that we'll convert values to strings on set().
	//	Also note that if the stored value is the empty string,
	//	we'll return the defaultValue if specified.
	//
	////////////////
	Property.StringAttribute = function Property_StringAttribute(property, defaultValue, additionalOptions) {
		if (!additionalOptions) additionalOptions = {};
		if (!additionalOptions.useDefaultFor) additionalOptions.useDefaultFor = [""];
		return AttributeFactory({
			type			: "string",
			property		: property,
			defaultValue	: defaultValue,
			getter			: null,
			setter			: anythingToString
		}, additionalOptions);
	}

	function anythingToString(value, thing, options) {
		return ""+value;
	}


	////////////////
	//
	// 	Number attribute -- will yeild a float or an int, depending on original value.
	//
	//	NOTE: If you pass a percentage (eg: "50%", "-124.21312%"), we'll convert to a float properly,
	//		  although we won't convert it back to a percent on save).
	//
	//	On get(), if we don't have a valid number we'll use defaultValue.
	//	On set(), if we don't have a valid number, we'll clear the value.
	//
	////////////////
	Property.NumberAttribute = function Property_NumberAttribute(property, defaultValue, additionalOptions) {
		return AttributeFactory({
			type			: "number",
			property		: property,
			defaultValue	: defaultValue,
			getter			: stringToNumber,
			setter			: numberToString
		}, additionalOptions);
	}

	var PERCENT_PATTERN = /\s*(-?(\d+|\d*\.\d+))%/;		// regular expression to match a percentage.
	function stringToNumber(value, thing, options) {
		if (typeof value === "string" && PERCENT_PATTERN.test(value)) {
			value = parseFloat(value) * 100;
		} else {
			value = parseFloat(value);
		}
		if (isNaN(value)) return undefined;
		return value;
	}
	function numberToString(value, thing, options) {
		value = parseFloat(value);
		if (isNaN(value)) return undefined;
		return ""+value;
	}



	////////////////
	//
	// 	Integer attribute.
	//	On get(), if we don't have a valid integer we'll use defaultValue.
	//	On set(), if we don't have a valid integer, we'll clear the value.
	//
	////////////////
	Property.IntegerAttribute = function Property_IntegerAttribute(property, defaultValue, additionalOptions) {
		return AttributeFactory({
			type			: "integer",
			property		: property,
			defaultValue	: defaultValue,
			getter			: stringToInt,
			setter			: intToString
		}, additionalOptions);
	}

	function stringToInt(value, thing, options) {
		value = parseInt(value);
		if (isNaN(value)) return undefined;
		return value;
	}
	function intToString(value, thing, options) {
		value = parseInt(value);
		if (isNaN(value)) return undefined;
		return ""+value;
	}


	////////////////
	//
	// 	Size attribute, specified as {width:, height:}.
	//
	////////////////
	Property.SizeAttribute = function Property_SizeAttribute(property, defaultValue, additionalOptions) {
		return AttributeFactory({
			type			: "size",
			property		: property,
			defaultValue	: defaultValue,
			getter			: stringToSize,
			setter			: sizeToString
		}, additionalOptions);
	}

	function stringToSize(value, thing, options) {
		if (typeof value !== "string") return undefined;
		value = value.split("x");
		var width = parseFloat(value[0]);
		var height = parseFloat(value[1]);
		if (isNaN(width) || isNaN(height)) return undefined;
		return {width:width, height:height};
	}
	function sizeToString(value, thing, options) {
		if (!value || value.width == null || value.height == null) return undefined;
		return ""+value.width+","+value.height;
	}


	////////////////
	//
	// 	Position attribute, specified as {left:, top:}.
	//
	////////////////
	Property.PositionAttribute = function Property_PositionAttribute(property, defaultValue, additionalOptions) {
		return AttributeFactory({
			type			: "position",
			property		: property,
			defaultValue	: defaultValue,
			getter			: stringToPosition,
			setter			: positionToString
		}, additionalOptions);
	}

	function stringToPosition(value, thing, options) {
		if (typeof value !== "string") return undefined;
		value = value.split(",");
		var left = parseFloat(value[0]);
		var top = parseFloat(value[1]);
		if (isNaN(left) || isNaN(top)) return undefined;
		return {left:left, top:top};
	}
	function positionToString(value, thing, options) {
		if (!value || value.left == null || value.top == null) return undefined;
		return ""+value.left+","+value.top;
	}


	////////////////
	//
	// 	Boolean attribute.
	// 	When get()ting, we ignore case and leading whitespace,
	//		and considered the following to be `false`:  "0", "n", "NO", "false", "fALsE", "f", etc.
	// 		Anything else is considered true.
	// 	When set()ting, we'll convert to a boolean and always save as "YES" or "NO".
	//
	////////////////
	Property.BooleanAttribute = function Property_BooleanAttribute(property, defaultValue, additionalOptions) {
		return AttributeFactory({
			type			: "boolean",
			property		: property,
			defaultValue	: defaultValue,
			getter			: primitiveToBoolean,
			setter			: booleanToString
		}, additionalOptions);
	}

	function primitiveToBoolean(value, thing, options) {
//console.warn("'"+value+"'", thing, options, typeof value);
		if (typeof value === "boolean") return value;
		if (typeof value === "number") return (value !== 0);
		if (typeof value !== "string" || value === "") return options.defaultValue;

		// if it's exactly a number represented as a string,
		//	return true unless the number is 0.
		var numberValue = parseFloat(value);
		if (!isNaN(numberValue) && ""+numberValue === value) return (value === 0);

		// a string, check for first letter as "F"alse or "N"o
		value = value.trim().toLowerCase();
		return !(value[0] === "n" || value[0] === "f" || value === "off");
	}
	function booleanToString(value, thing, options) {
		value = primitiveToBoolean(value);
		if (typeof value !== "boolean") return undefined;
		return (value ? "yes" : "no");
	}


	////////////////
	//
	// Choice attribute -- attribute with a number of string `choices`.
	//   Pass the choices as an array of strings or a single comma-separated string.
	//	 The first choice in the list will be the default value.
	//
	//	When get()ting, if the value stored doesn't match one of the choices, we'll ignore it and return the default.
	//	When set()ting, if the value stored doesn't match one of the choices, we'll clear the value.
	//
	////////////////
	Property.ChoiceAttribute = function Property_ChoiceAttribute(property, choices, additionalOptions) {
		if (typeof choices === "string") choices = choices.split(",");
		if (!choices || !choices.forEach) throw "Property.ChoiceAttribute(): you must pass choices as an array or comma-separated string";
		var defaultValue = choices[0];

		return AttributeFactory({
			type			: "choice",
			property		: property,
			defaultValue	: defaultValue,
			choices			: choices,
			getter			: validateChoice,
			setter			: validateChoice
		}, additionalOptions);
	}

	function validateChoice(value, thing, options) {
		value = ""+value;
		if (!options.choices.contains(value)) return undefined;
		return value;
	}


	////////////////
	//
	// 	List attribute -- converts a delimited string to an array.
	//  NOTE: the second attribute is the delimiter, which defaults to ",".
	//
	// 	When get()ting, we ignore leading whitespace, and split on the delimiter, returning a NEW array each time.
	//	NOTE: this array is NOT STABLE, in that direct modifications to the array will NOT be reflected
	//		  in the internal value automatically.  You must manipulate the array, then set the property
	//		  to the new value to have it remembered in the attributes object.
	//
	//	  eg: 	var list = thing.someListAttribute;			// list is an array
	//			list.push("some other value");				// manipulate however you want
	//			thing.someListAttribute = list;				// save it back
	//
	////////////////
	Property.ListAttribute = function Property_ListAttribute(property, delimiter, additionalOptions) {
		if (!delimiter) delimiter = ",";
		// eat whitespace on either side of the delimiter
		var splitter = new RegExp("\\s*"+delimiter+"\\s*", "g");
		return AttributeFactory({
			type			: "list",
			property		: property,
			getter			: stringToList,
			setter			: listToString,
			delimiter		: delimiter,
			splitter		: splitter
		}, additionalOptions);
	};

	function stringToList(value, thing, options) {
		// empty string returns empty array
		if (typeof value === "string" && value.length > 0) return value.split(options.splitter);
		return [];
	}
	function listToString(value, thing, options) {
		if (value == null) return undefined;
		if (typeof value === "string") return value;
		if (typeof value.join === "function") return value.join(options.delimiter);
		// TODO: show error here?
		return undefined;
	}



	////////////////
	//
	// 	Date attribute -- converts a date string to a date.
	//	For the `defaultValue`, you can pass:
	//		- a Date object
	//		- "now" (which will be recalculated each time the property is returned)
	//		- a date string in the specified `format`.
	//	For the 'format' attribute, you can pass:
	//		- "ISO"			= YYYY-MM-DDTHH:MM:SS
	//		- "float"		= YYYYMMDD.HHMMSS
	//
	//	NOTE: the date returned by the getter is NOT AUTOMATICALLY MUTABLE,
	//		  in that direct modifications to the date will NOT be reflected
	//		  in the internal value automatically.  You must manipulate the array, then set the property
	//		  to the new value to have it remembered in the attributes object.
	//
	//	  eg: 	var date = thing.someDateAttribute;			// `date` is a Date object
	//			date.setDay(1);								// manipulate however you want
	//			thing.someDateAttribute = date;				// save it back
	//
	////////////////
	Property.DateAttribute = function Property_DateAttribute(property, defaultValue, formatter, additionalOptions) {
		if (!formatter) delimiter = "ISO";
		// validate to the formats we understand
		if (formatter != "ISO" && formatter != "float") throw "new Property.DateAttribute("+property+"): don't understand formatter "+formatter;
		return AttributeFactory({
			type			: "date",
			property		: property,
			defaultValue	: defaultValue,
			getter			: stringToDate,
			setter			: dateToString,
			formatter		: formatter
		}, additionalOptions);
	}

	function stringToDate(value, thing, options, skipDefault) {
		if (!value && !skipDefault) {
			if (options.defaultValue) return stringToDate(options.defaultValue);
		}
		if (value instanceof Date) return value;
		if (typeof value === "string") {
			if (value === "now") return new Date();
			if (options.formatter === "ISO") 	return Date.fromISOString(value);
			if (options.formatter === "float") 	return Date.fromFloatString(value);
		}
		// TODO: show error
		return undefined;
	}
	function dateToString(value, thing, options) {
		if (!value) return undefined;
		// if a string, convert to a Date for validation
		if (typeof value === "string") {
			var dateValue = stringToDate(value, thing, options, true);
			// TODO: error
			if (!dateValue) return undefined;
			value = dateValue;
		}
		if (value instanceof Date) {
			if (options.formatter === "ISO") return value.toISO();
			if (options.formatter === "float") return value.toFloat();
		}
		// TODO: show error here?
		return undefined;
	}


	return Property;
});
