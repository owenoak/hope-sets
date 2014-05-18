/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	"Scrollbar" page indicator -- scrollbar like thing.
//	Hook this up by giving it a "parent" object which is Pageable.
//
//	NOTE: THIS IS ONLY SET UP TO WORK HORIZONTALLY!
//

Module.define("oak/lib/ui/Scrollbar", "oak/lib/core/Class,oak/lib/ui/Widget", function(Class, Widget) {

	return new Class("Scrollbar", "Widget", {
		// Widget who we report paging events to (and who tells us to update).
		parent : undefined,

		parts : {
			$track		: "## .ScrollTrack",
			$thumb		: "## .ScrollThumb"
		},

		events : [
			{ selector : "## .ScrollTrack", event:"mouseup", handler:"onTrackUp" },
		],

		widgetTemplate	: "<div id='{{id}}' class='{{constructor.id}} {{className}}'>"
							+ "<div class='ScrollTrack'>"
								+ "<div class='ScrollThumb'></div>"
							+"</div>"
						+ "</div>",

		onReady : function() {
			if (this.parent && this.parent.$root) this.parent.$root.addClass("HasScrollbar");
		},

		// Update to show the correct number of pips when required.
		updateContents : function() {
			var sizes = this.getSizes();
			if (sizes.pageCount === 0) {
				this.clearContents();
				return;
			}

			var props = {
				width	: sizes.thumbSize,
				left	: sizes.thumbLeft
			}
			this.$thumb.animate(props);
			this.asWidget("updateContents");
		},

		// return the current geometry for the scrollbar, according to our `.parent`s pageCount and pageNumber
		getSizes : function(event) {
			var sizes = {};
			sizes.pageCount = (this.parent ? this.parent.pageCount : 0);
			if (sizes.pageCount === 0) return sizes;

			sizes.currentPage = (this.parent ? this.parent.pageNumber : 0);

			sizes.trackSize = this.$track.width();
			sizes.thumbSize = Math.round(sizes.trackSize / sizes.pageCount);
			sizes.thumbLeft = Math.round(sizes.currentPage * sizes.trackSize / sizes.pageCount);

			// if an event was passed, figure out which page the event corresponds to
			if (event) {
				var trackLeft = this.$track.clientOffset().left;
				var eventLeft = event.pageX;
				var delta = (eventLeft - trackLeft);
				sizes.eventPage = Math.floor(delta / sizes.thumbSize);
			}

			return sizes;
		},

		clearContents : function() {
			this.$track.hide();
		},

		onTrackUp : function(event) {
			var sizes = this.getSizes(event);
			if (this.parent && sizes.eventPage !== parent.currentPage) {
				this.parent.soon("showPage", [sizes.eventPage]);
			}
		}

	});	// end new Class("Scrollbar")

});	// end define("oak/lib/ui/Scrollbar")
