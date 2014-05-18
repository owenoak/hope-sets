/* 	Normalizing key events.

	Note that key handling in browsers is notoriously shitty.
	We attempt to map "logical" keys (like "A" or "return" or "shift control w") to key events.

	Currently this is only tested in latest Gecko + Webkit on Mac,
	IT IS VERY LIKELY TO BE BROKEN ON OTHER PLATFORMS.
	
	Also, this is only tested in en/us with a standard US keyboard,
	IT IS VERY LIKELY BROKEN FOR OTHER LANGUAGES AND KEYBOARDS.
	
	Note that things are tending toward the IE model for keyboard mapping and event handling,
	so we default to that.  This doesn't mean it will work in IE.
	
	For a good explanation of what works, see:	http://unixpapa.com/js/key.html
	
	
	WIERD STUFF TO BE AWARE OF:
		- Capturing repeating keys:
			- in gecko, use keyPRESS
			- in webkit, use keyDOWN (both keydown and keypress repeat, put keypress doesnt always fire)
	
		- Global key events, eg: `window.on("keypress", ...)`
			- in gecko, global events go to <html>
			- in webkit, global events go to <body>
	
	
*/

Script.require("{{hope}}Event.js", function(){


//
//	Browser.EVENT.globalKeyListenerTagName
//		- tagname of the element which gets the global keypress event
//		ASSUMPTION - assumes tagnames always returning in upper case
//
	Browser.EVENT.globalKeyListenerTagName = (Browser.gecko ? "HTML" : "BODY");

//
//	Event.repeatingKeyEvent
//		- We want to repeatedly capture key events when they hold the key down.
//				On gecko, we do this on keyPRESS, because keyDOWN does nor repeaet.
//				On webkit/etc, we do this on keyDOWN, because keyDOWN does repeat,
//					and keyPRESS doesn't fire at all for some keys
	Browser.EVENT.keypress = (Browser.gecko ? "keypress" : "keydown");
	



//
//	Normalizing key events:
//		- when one or more keys are active, we stick a bunch of properties on Event
//			which normalizes which keys are being pressed, etc
//


	// Figure out the key that's currently down in keyDOWN or keyUP, which is fairly reliable.
	// Note that this logic will NOT work on keyPRESS.
	function _rememberActiveKeysForKeyDownOrUpEvent(event) {
		// remember the state of the modifier keys for convenience of other routines
		Event.keyCode = event.keyCode;
		Event.shift = event.shiftKey;
		Event.alt = Event.option = event.altKey;
		Event.ctrl = Event.control = event.ctrlKey;
		Event.meta = Event.command = event.metaKey;
		Event.keyTarget = event.target;

		// figure out the logical keyId for this event
		Event.shortcut = Shortcut.normalize(event);
	}
	
	
	// Remember which keys are active in keyDOWN BEFORE any other processing happens
	window.capture("keydown", function onKeyDown(event) {
		_rememberActiveKeysForKeyDownOrUpEvent(event);
		
		// trap certain keys at the global level so we don't leave the page stupidly
		if (Event.keyTarget.tagName == Browser.EVENT.globalKeyListenerTagName) {
			if (Event.globalKeyIgnoreMap[Event.shortcut]) event.preventDefault();
		}

//		console.info("down", event.keyCode, Event.shortcut);
	});
	
	// Reset which keys are active in keyUP BEFORE any other processing happens
	window.capture("keyup", function onKeyUp(event) {
		_rememberActiveKeysForKeyDownOrUpEvent(event);
	});
	
	// global keypresses which we should ALWAYS ignore
	Event.globalKeyIgnoreMap = {
		'backspace' : true,		// BROWSER: previous page
		'meta left' : true,		// BROWSER: previous page
		'meta right': true,		// BROWSER: previous page
		'ctrl left' : true,		// BROWSER: scroll
		'ctrl right': true,		// BROWSER: scroll
		'ctrl up' : true,		// BROWSER: scroll
		'ctrl down': true,		// BROWSER: scroll
	}
	if (Browser.gecko) {
		//
		Event.globalKeyIgnoreMap["'"] = true;		// BROWSER: 'quick find'
		Event.globalKeyIgnoreMap["/"] = true;		// BROWSER: 'quick find'
		Event.globalKeyIgnoreMap["num/"] = true;	// BROWSER: 'quick find'
		
	} else if (Browser.webkit) {
	
	}


//
//	Logical keyIds
//		We attempt to rationalize the various browsers wild and wooly key implementations.
//
//		Our key events are done in terms of "keyIds", which are normalized descriptions
//		of a particular set of keys, eg:  shift alt return  = <return>+<shift>+<alt>
//

	var UNKNOWN_KEY = "UNKNOWN_KEY"

//
//  Shortcut:  simple (internal) class to go from key properties to a keyId
//

	function Shortcut(it) {
		if (it) {
			if (typeof it === "string") {
				this.name = it;
			} else if (it instanceof Event) {
				this._setFromKeyDownEvent(it);
			} else if (it instanceof Element) {
				this.name = it.shortcut;
			} else if (typeof it === "object") {
				for (var key in it) this[key] = it[key];
			} else {
				console.error("new Shortcut(",it,") type not understood");
			}
		}
	}
	
	Shortcut.normalize = function(shortcut) {
		if (!shortcut) return undefined;
		return new Shortcut(shortcut).keyId;
	}
	
	hope.extend(Shortcut.prototype, {
		keyId : Getter(function() {
			var output = [];
			if (this.shift)		output.push("shift");
			if (this.alt)		output.push("alt");
			if (this.ctrl)		output.push("ctrl");
			if (this.meta)		output.push("meta");
			if (this.name) 		output.push(this.name);
			return output.join(" ");
		}),
	
		name : Property({
			get : function() { return this._name || ""},
			set : function(newValue) {
				if (newValue.indexOf(" ") > -1) {
					newValue.split(" ").forEach(this._setNameWord, this);
				} else {
					this._setNameWord(newValue);
				}
			}
		}),
		
		// set a single name word, special cases "shift", "alt", etc
		_setNameWord : function(word) {
			// check to see if the word is the name of a modifier
			var modifier = word.toLowerCase();
			switch (modifier) {
				case "shift":
				case "alt":
				case "ctrl":
				case "meta":
				case "control":
				case "option":
				case "command":
					this[modifier] = true;
					return;
			}
			this._name = word;
		},
		
		// return the logical key associated with a keyDOWN or keyUP event
		_setFromKeyDownEvent : function(event) {
			if (event.shiftKey) this.shift = true;
			if (event.altKey) 	this.alt = true;
			if (event.ctrlKey)  this.ctrl = true;
			if (event.metaKey) 	this.meta = true;

			var code = ""+(event.keyCode||event.which), match;
			if (code === "0") return this.name = UNKNOWN_KEY;
			
			// if it's a simple modifier key, we're done
			if (Event.keyDownModifierCodeMap[code]) return;
			
			// do a reverse lookup from the code to a key name
			if (match = Event.keyDownCodeMap[code]) return (this.name = match);

			// if the shift key is down, look up as "shift "+code
			if (match = Event.keyDownCodeMap["shift "+code]) return (this.name = match);
			
			// no match, signal that we don't recognize the key combo
			this.name = UNKNOWN_KEY;
		},
		
		// modifiers
		
		// W3C names (which come from the PC)
		shift : false,
		alt : false,
		ctrl : false,
		meta : false,
		
		// mac names (as aliases of the PC names)
		control : PropertyAlias("control", "ctrl"),
		option : PropertyAlias("option", "alt"),
		command : PropertyAlias("command", "meta")
	});

	hope.setGlobal("Shortcut", Shortcut);


// these key mappings are consistent between Webkit and Gecko FOR KEYDOWN ONLY
// NOTE: I'm pretty sure this is keyboard-layout specific to the US keyboard
// NOTE: THIS IS ALL TESTED MAC ONLY!
Event.keyDownKeyMap = {
	"tab"		:"9",
	"backspace"	:"8",		// MAC/Webkit:  navigates back one page
	"return"	:"13",
	
	"clear"		:"12",		// (on keypad)
	"capslock"	:"20",
	
	"space"		:"32",
	"esc"		:"27",

	"insert"	:"45",
	"delete"	:"46",
	"home"		:"36",
	"end"		:"35",
	
	"pageup"	:"33",
	"pagedown"	:"34",
	"left"		:"37",
	"up"		:"38",
	"right"		:"39",
	"down"		:"40",

	"scrolllock":"145",
	"numlock"	:"144",

	"a"			:"65",
	"b"			:"66",
	"c"			:"67",
	"d"			:"68",
	"e"			:"69",
	"f"			:"70",
	"g"			:"71",
	"h"			:"72",
	"i"			:"73",
	"j"			:"74",
	"k"			:"75",
	"l"			:"76",
	"m"			:"77",
	"n"			:"78",
	"o"			:"79",
	"p"			:"80",
	"q"			:"81",
	"r"			:"82",
	"s"			:"83",
	"t"			:"84",
	"u"			:"85",
	"v"			:"86",
	"w"			:"87",
	"x"			:"88",
	"y"			:"89",
	"z"			:"90",

	"A"			:"shift 65",
	"B"			:"shift 66",
	"C"			:"shift 67",
	"D"			:"shift 68",
	"E"			:"shift 69",
	"F"			:"shift 70",
	"G"			:"shift 71",
	"H"			:"shift 72",
	"I"			:"shift 73",
	"J"			:"shift 74",
	"K"			:"shift 75",
	"L"			:"shift 76",
	"M"			:"shift 77",
	"N"			:"shift 78",
	"O"			:"shift 79",
	"P"			:"shift 80",
	"Q"			:"shift 81",
	"R"			:"shift 82",
	"S"			:"shift 83",
	"T"			:"shift 84",
	"U"			:"shift 85",
	"V"			:"shift 86",
	"W"			:"shift 87",
	"X"			:"shift 88",
	"Y"			:"shift 89",
	"Z"			:"shift 90",

	","			:"188",
	"."			:"190",
	"/"			:"191",			// NO in Mac/Gecko: gecko "quick search"
	"`"			:"192",
	"["			:"219",
	"]"			:"221",
	"\\"		:"220",
	"'"			:"222",

	"<"			:"shift 188",	// NO in Mac/Gecko: returns 0 when typed
	">"			:"shift 190",	// NO in Mac/Gecko: returns 0 when typed
	"?"			:"shift 191",	// NO in Mac/Gecko: returns 0 when typed
	"~"			:"shift 192",
	"{"			:"shift 219",
	"}"			:"shift 221",
	"|"			:"shift 220",	// NO in Mac/Gecko: returns 0 when typed
	'"'			:"shift 222",

	"0"			:"48",
	"1"			:"49",
	"2"			:"50",
	"3"			:"51",
	"4"			:"52",
	"5"			:"53",
	"6"			:"54",
	"7"			:"55",
	"8"			:"56",
	"9"			:"57",

	"!"			:"shift 49",
	"@"			:"shift 50",
	"#"			:"shift 51",
	"$"			:"shift 52",
	"%"			:"shift 53",
	"^"			:"shift 54",
	"&"			:"shift 55",
	"*"			:"shift 56",
	"("			:"shift 57",
	")"			:"shift 48",

	"f1"		:"112",
	"f2"		:"113",
	"f3"		:"114",			// NO in Mac/Webkit+Gecko: system override for expose
	"f4"		:"115",			// NO in Mac/Webkit+Gecko: system override for expose
	"f5"		:"116",			// NO in Mac/Gecko: reload page
	"f6"		:"117",
	"f7"		:"118",			// NO in Mac/Gecko: gecko "caret browsing"
	"f8"		:"119",
	"f9"		:"120",
	"f10"		:"121",
	"f11"		:"122",			// NO in Mac/Gecko:	full-screen
	"f12"		:"123",			// NO in Mac/Gecko:	firebug

	"num/"		:"111",
	"num*"		:"106",
	"num-"		:"109",
	"num."		:"110",
	
	"num0"		:"96",
	"num1"		:"97",
	"num2"		:"98",
	"num3"		:"99",
	"num4"		:"100",
	"num5"		:"101",
	"num6"		:"102",
	"num7"		:"103",
	"num8"		:"104",
	"num9"		:"105",	
}

// special keys for webkit FOR KEYDOWN ONLY
if (Browser.webkit) {
	hope.extend(Event.keyDownKeyMap, {
		"-"			:"189",
		"="			:"187",
		";"			:"186",
	
		"_"			:"shift 189",
		"+"			:"shift 187",
		":"			:"shift 186",	

//		"num="		:"187",			// NO: same as normal "="
		"num-"		:"109",
		"num+"		:"107",
	
		"f13"		:"124",
		"f14"		:"125",
		"f15"		:"126",
		"f16"		:"127",
		"f17"		:"128",
		"f18"		:"129",
		"f19"		:"130",
	});
} 

// special keys for gecko FOR KEYDOWN ONLY
else if (Browser.gecko) {
	hope.extend(Event.keyDownKeyMap, {
		"-"			:"109",
		"="			:"61",
		";"			:"59",
	
		"_"			:"shift 109",
		"+"			:"shift 107",
//		":"			:"shift 59",// NO in Mac/Gecko: returns 0 when typed	
	
//		"num="		:"61",		// NO: same as normal "="
//		"num-"		:"109",		// NO: same as normal "-"
//		"num+"		:"107",		// NO: same as normal "+"
	
		"f13"		:"44",
	//	"f14"		:"145",		// NO in Mac/Gecko:  "f15"
		"f15"		:"19",		// ?
	//	"f16"		:"127",		// NO in Mac/Gecko: returns 0 when typed
	//	"f17"		:"128",		// NO in Mac/Gecko: returns 0 when typed
	//	"f18"		:"129",		// NO in Mac/Gecko: returns 0 when typed
	//	"f19"		:"130",		// NO in Mac/Gecko: returns 0 when typed

	});
} 
// browser not fully understood
else {
	console.warn("Key events not fully supported in this browser");
}


// map of char code (possibly + shift) to logical key
Event.keyDownCodeMap = Object.invertMap(Event.keyDownKeyMap);


// special case for single modifier key held down by itself
Event.keyDownModifierKeyMap = {
	"shift"		:"16",
	"ctrl"		:"17",
	"alt"		:"18",
	"meta"		:(Browser.gecko ? "224" : "91")	// Ugh
}
Event.keyDownModifierCodeMap = Object.invertMap(Event.keyDownModifierKeyMap);




Script.loaded("{{hope}}Event-keys.js");
});
