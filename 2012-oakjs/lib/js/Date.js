/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
// Date extensions
//
Module.define("oak/lib/js/Date",
"oak/lib/js/Object,oak/lib/js/Number,oak/lib/core/Property",
function(Object, Number, Property) {
	Property.patch(Date.prototype, {

		// Return this date in ISO 8601 Extended format:
		//		YYYY-MM-DDTHH:MM:SSZ
		//
		// Pass `true` to `userLocalTimeZone` to print in this browser's time zone,
		//	otherwise we'll use UTC.
		toISO : function(useLocalTimeZone) {
			if (useLocalTimeZone) {
				var offset = -this.getTimezoneOffset()/60;
				if (offset >= 0)	offset = '+' + offset.pad(2);
				else				offset = offset.pad(2);
				return this.getFullYear() + "-" + (this.getMonth()+1).pad(2) + "-" + this.getDate().pad(2)
						+ "T"
						+ this.getHours().pad(2) + ":" + this.getMinutes().pad(2) + ":" + this.getSeconds().pad(2)
						+ offset + ':00';
			} else {
				return this.getUTCFullYear() + "-" + (this.getUTCMonth()+1).pad(2) + "-" + this.getUTCDate().pad(2)
						+ "T"
						+ this.getUTCHours().pad(2) + ":" + this.getUTCMinutes().pad(2) + ":" + this.getUTCSeconds().pad(2)
						+ "Z";
			}
		},

		// Return this date in our 'float' format:
		//		YYYYMMDD.HHMMSS
		//
		// Pass `true` to `userLocalTimeZone` to print in this browser's time zone,
		//	otherwise we'll use UTC.
		toFloat : function(useLocalTimeZone) {
			if (useLocalTimeZone) {
				return this.getFullYear() + (this.getMonth()+1).pad(2) + this.getDate().pad(2)
						+ "."
						+ this.getHours().pad(2) + this.getMinutes().pad(2) + this.getSeconds().pad(2);
			} else {
				return this.getUTCFullYear() + (this.getUTCMonth()+1).pad(2) + this.getUTCDate().pad(2)
						+ "."
						+ this.getUTCHours().pad(2) + this.getUTCMinutes().pad(2) + this.getUTCSeconds().pad(2);
			}
		},

		// Return a copy of this date, reset the exact start of that date (kill the time portion)
		clearTime : function() {
			return new Date(this.getFullYear(), this.getMonth(), this.getDate());
		},

		// Return the full name of this month.
		//	NOTE: english only
		getMonthName : function() {
			return Date.monthNames[""+(this.getMonth()+1).pad(2)];
		},

		// Return the abbreviated name of this month.
		//	NOTE: english only
		getMonthAbbrev : function() {
			return Date.monthNames[""+(this.getMonth()+1).pad(2)].substr(0,3);
		},

		// Return the day portion of the date in a "pretty" format
		//	<month name> <date> <year>
		toPrettyDate : function() {
			return this.getMonthName() + " " + this.getDate() + ", " + this.getFullYear();
		},

		// Return the day portion of the date in a "pretty" format
		//	<month name abbreviated> <date> <year>
		toPrettyShortDate : function() {
			return this.getMonthAbbrev() + " " + this.getDate() + ", " + this.getFullYear();
		},

		// Return the time as a pretty string, as "HH:MM"+[am|pm]
		toPrettyTime : function() {
			var hours = this.getHours(),
				minutes = this.getMinutes(),
				meridian = (hours >= 12 ? "pm" : "am")
			;
			if (hours > 12) hours -= 12;
			if (hours === 0) hours = 12;

			return hours + ":"+minutes.pad(2)+meridian;
		},

		toPrettyDateTime : function() {
			return this.toPrettyShortDate() + " at " + this.toPrettyTime();
		},

		// Return a string which indicates how this date compares to today:
		//	if it is today, returns "today"
		//	if it is in the past, returns "N days ago"
		//	if it is in the future, returns "N days from now"
		daysAgo : function(since) {
			since = since || new Date();
			var timeDelta = this.clearTime().getTime() - since.clearTime().getTime();
			var msecInOneDay = 1000*60*60*24;
			var dayCount = Math.round(timeDelta / msecInOneDay);

			var modifier = (dayCount < 0 ? "ago" : "from now");
			dayCount = Math.abs(dayCount);
			return dayCount + (dayCount === 1 ? " day " : " days ") + modifier;
		},

		// Return date as a 'relative' string,  "<date.toPrettyDate()> (<date.daysAgo>)"
		toRelativeDate : function(since) {
			return this.toPrettyDate() + " (" + this.daysAgo(since) + ")";
		}

	});

	var ISODateRE = /(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d).*[zZ]?/;
	var floatDateRE = /(\d\d\d\d)(\d\d)(\d\d).(\d\d)(\d\d)(\d\d)/;

	Property.extend(Date, {
		// Given a date string in our server format (basically, ISO 8601), convert to a JS Date.
		fromISOString : function(string) {
			var match = ISODateRE.exec(string), date;
			if (match) {
				date = new Date();
				date.setUTCFullYear(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
				date.setUTCHours(parseInt(match[4], 10), parseInt(match[5], 10), parseInt(match[6], 10), 0);
			}
			return date;
		},

		// Given a date in "float" format (YYYYMMDD.HHMMSS in GMT), return a normal date.
		fromFloatString : function(string) {
			var match = floatDateRE.exec(string), date;
			if (match) {
				date = new Date();
				date.setUTCFullYear(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
				date.setUTCHours(parseInt(match[4], 10), parseInt(match[5], 10), parseInt(match[6], 10), 0);
			}
			return date;
		},

		// TODO: get this from somewhere else!
		monthNames : {
			"01" : "January",
			"02" : "February",
			"03" : "March",
			"04" : "April",
			"05" : "May",
			"06" : "June",
			"07" : "July",
			"08" : "August",
			"09" : "September",
			"10" : "October",
			"11" : "November",
			"12" : "December"
		},


		// convert a time (specified as a number, in seconds) to a pretty "relative" time
		RELATIVE_TIME_CHUNKS : [
			{unit:"days",    minimum: 60*60*24, abbrev:"d"},
			{unit:"hours",   minimum: 60*60,	abbrev:"h"},
			{unit:"minutes", minimum: 60,		abbrev:"m"},
			{unit:"seconds", minimum: 1,		abbrev:"s"}
		],
		getRelativeTime : function(seconds, ignoreIf0) {
			seconds = parseInt(seconds, 10);
			if (isNaN(seconds)) return "";

			if (ignoreIf0 && seconds === 0) return "";
			var i = -1, chunk, modifier = "";

			if (seconds < 0) {
				seconds = -seconds;
				modifier = " ago";
			}
			if (seconds === 0) return "0s";

			while ((chunk = Date.RELATIVE_TIME_CHUNKS[++i])) {
				if (seconds > chunk.minimum) {
					var chunks = Math.floor(seconds / chunk.minimum);
					var remainder = seconds - (chunks * chunk.minimum);
					return (chunks + chunk.abbrev + " " + Date.getRelativeTime(remainder, true)).trim() + modifier;
				}
			}
		}
	});


	// Add some related rotines to String.prototype for working with dates.
	Property.patch(String.prototype, {
		// Given a string which possibly has `{{datenum}}` or `{{dateiso}}` in it,
		//	expand those to the current date in the appropriate format.
		expandDates : function(useLocalTimeZone) {
			return this.expand({
				datenum				: new Date().toFloat(useLocalTimeZone).replace(/\..*/,''),
				dateiso				: new Date().toISO(useLocalTimeZone).replace(/T.*/,''),
				datepretty			: new Date().toPrettyDate(),
				dateprettyshort		: new Date().toPrettyShortDate(),
			});
		}
	});

	return Date;
});	// end define("oak/lib/js/Date")
