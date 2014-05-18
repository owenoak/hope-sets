/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	"PageArrows" page indicator -- left and right arrows which switch pages.
//	Hook this up by giving it a "parent" object which is Pageable.
//

Module.define("oak/lib/ui/PageArrows", "oak/lib/core/Class,oak/lib/ui/Widget", function(Class, Widget) {

	return new Class("PageArrows", "Widget", {
		// Widget who we report paging events to (and who tells us to update).
		parent : undefined,

		parts : {
			$prevArrow	: "##Prev",
			$nextArrow	: "##Next"
		},

		events : [
			{ selector : "$prevArrow", event:"click", handler:"onPrevArrowClicked" },
			{ selector : "$nextArrow", event:"click", handler:"onNextArrowClicked" }
		],

		widgetTemplate :  "<button id='{{id}}Next' class='PageArrow NextArrow'></button>"
						+ "<button id='{{id}}Prev' class='PageArrow PrevArrow'></button>",

		onReady : function() {
			if (this.parent && this.parent.$root) this.parent.$root.addClass("HasPageArrows");
		},

		// Update to show/hide the page arrows as appropriate.
		updateContents : function() {
			if (!this.parent) return this.clearContents();

			var parentIsShowing = this.parent.isShowing;
			var pageCount = this.parent.pageCount;
			var page = this.parent.pageNumber;

			var showPrevPage = parentIsShowing && (pageCount !== 0) && (parent.pageWrap || page !== 0);
			this.$prevArrow.toggle(showPrevPage);

			var showNextPage = parentIsShowing && (pageCount !== 0) && (parent.pageWrap || page < pageCount-1);
			this.$nextArrow.toggle(showNextPage);
			this.asWidget("updateContents");
		},

		clearContents : function() {
			this.$nextArrow.hide();
			this.$prevArrow.hide();
		},

		onPrevArrowClicked : function(event, $arrow) {
			if (this.parent) this.parent.showPrevPage();
		},
		onNextArrowClicked : function(event, $arrow) {
			if (this.parent) this.parent.showNextPage();
		}

	});	// end new Class("PageArrows")

});	// end define("oak/lib/ui/PageArrows")
