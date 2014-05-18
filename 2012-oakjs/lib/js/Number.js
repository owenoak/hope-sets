/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Number extensions
//
Module.define("oak/lib/js/Number", "oak/lib/js/Object", function() {

	Math.SECONDS_PER_MINUTE 	= 60;
	Math.MINUTES_PER_HOUR		= 60;
	Math.HOURS_PER_DAY			= 24;
	Math.SECONDS_PER_HOUR	 	= Math.SECONDS_PER_MINUTE * Math.MINUTES_PER_HOUR;
	Math.SECONDS_PER_DAY		= Math.SECONDS_PER_HOUR * Math.HOURS_PER_DAY;

	Property.patch(Number.prototype, {
		// round to n digits of precision, returns a number.
		precision : function(digits) {
			var multiplier = Math.pow(10, digits);
			return Math.round(this * multiplier) / multiplier;
		},

		// pad the integer part of this number to a certain number of digits, returns a string
		pad : function(digits) {
			var intString = ""+this;
			if (!digits) return intString;

			var periodIndex = intString.indexOf("."), decimal = "", sign = "";
			if (periodIndex > -1) {
				decimal = intString.substr(periodIndex);
				intString = intString.substr(0, periodIndex);
			}
			if (intString.charAt(0) == "-") {
				sign = "-";
				intString = intString.substr(1);
			}
			while (intString.length < digits) intString = "0" + intString;
			return sign + intString + decimal;
		},

		// Generate a random number between 0 and this number, non-inclusive
		random : function() {
			return Math.floor(Math.random() * this);
		},

		// Add commas to this number and show exactly <digits> places after the period (eg: 1,000.10)
		commaize : function(digits) {
			var str = ""+this,
				prefix = "",
				suffix = "",
				negative = "",
				periodIndex = str.indexOf("."),
				precision = (digits == null ? 2 : (parseInt(digits) || 0))
			;
			if (periodIndex == -1) {
				if (digits != null && precision != 0) suffix = "." + "0".times(precision);
			} else {
				if (precision != 0) {
					suffix = str.substring(periodIndex).substring(0, precision+1);
					while(suffix.length < precision+1) suffix += "0";
				}
				str = str.substr(0, periodIndex);
			}

			if (str.charAt(0) == "-") {
				negative = "-";
				str = str.substr(1);
			}

			var firstSplit = str.length % 3;
			prefix += str.substring(0, firstSplit);

			var matches = str.substr(firstSplit).match(/\d\d\d/g) || [];
			if (prefix) matches.splice(0,0,prefix);
			return negative + matches.join(",") + suffix;
		},

		// Express a float as a percentage, limited to # digits of percentage,
		//	as a string with the "%" sign on the end.
		toPercent : function(precision) {
			return this.precision(precision) + "%";
		},

		// syntactic sugar
		round : function() {	return Math.round(this);	},
		ceil  : function() {	return Math.ceil(this);		},
		floor : function() {	return Math.floor(this);	},

		// Return this number as "meaningful" units of time.
		// Pass `units` of time that the number started in:
		//		- `"s"` = seconds (the default)
		//		- `"m"` = seconds (the default)
		//		- `"h"` = seconds (the default)
		// NOTE: this is fairly magical in its results.
		toTime : function(units) {
			if (!units) units = "s";
			var seconds;
			if (units === "s") 			seconds = this;
			else if (units === "m")		seconds = this * Math.SECONDS_PER_MINUTE;
			else if (units === "h")		seconds = this * Math.SECONDS_PER_HOUR;

			// make seconds an integer
			seconds = seconds.floor();

			// NOTE: < 0 is really meaningless...
			if (seconds <= 0) 		return "instantly";

			// less than a minute: return seconds
			if (seconds < Math.SECONDS_PER_MINUTE) 		return seconds+"s";

			// break into days, hours, minutes
			var days = (seconds/Math.SECONDS_PER_DAY).floor();

			// 0-24 hours
			seconds -= (days * Math.SECONDS_PER_DAY);
			var hours = (seconds/Math.SECONDS_PER_HOUR).floor();

			// 0-60 days
			seconds -= (hours * Math.SECONDS_PER_HOUR);
			var minutes = (seconds/Math.SECONDS_PER_MINUTE).floor();
			seconds -= (minutes * Math.SECONDS_PER_MINUTE);

			// if in days range, show `#d #h`  or `#d`.
			var output = [];
			if (days) {
				// if less than 2 days and we have hours, ignore days, report as hours
				if (days == 1 && hours !== 0) {
					hours += Math.HOURS_PER_DAY;
				} else {
					output.append(days+"d");
				}
				if (hours) output.append(hours+"h");
			} else if (hours) {
				// if less than 2 hours and we have minutes, ignore hours, report as minutes
				if (hours == 1 && minutes !== 0) {
					minutes += hours * Math.MINUTES_PER_HOUR;
				} else {
					output.append(hours+"h");
				}
				// only add minutes if > 5
				if (minutes > 5) {
					output.append(minutes+"m");
				}
			} else {
				// if less than 2 minutes, express as seconds
				if (minutes === 1 && seconds !== 0) {
					seconds += minutes + Math.MINUTES_PER_HOUR;
					output.append(seconds+"s");
				}
				// if less than 5 minutes, express as minutes + seconds
				else if (minutes <= 5 && seconds >= 10) {
					output.append(minutes+"m");
					output.append(seconds+"s");
				} else {
					output.append(minutes+"m");
				}
			}
			return output.join(" ");
		}
	});

	return Number;
});	// end define("oak/lib/js/Number")
