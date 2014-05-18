/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	"PagePips" page indicator -- set of dots which represents a set of pages.
//	Hook this up by giving it a "parent" object which is Pageable.
//

Module.define("oak/lib/ui/PagePips", "oak/lib/core/Class,oak/lib/ui/Widget", function(Class, Widget) {

	return new Class("PagePips", "Widget", {
		// Widget who we report paging events to (and who tells us to update).
		parent : undefined,

		events : [
			{ selector : "## .Pip", event:"click", handler:"onPipClicked" }
		],

		pipTemplate 	: "<div class='Pip {{className}}' page='{{page}}'><div class='Circle'></div></div>",


		onReady : function() {
			if (this.parent && this.parent.$root) this.parent.$root.addClass("HasPagePips");
		},

		// Update to show the correct number of pips when required.
		updateContents : function() {
			var pageCount = (this.parent ? this.parent.pageCount : 0);
			if (pageCount === 0) {
				this.clearContents();
				return;
			}
			var currentPage = (this.parent ? this.parent.pageNumber : 0);
			var html = [], props = {};
			for (var page = 0; page < pageCount; page++) {
				props.page = page;
				props.className = (page === currentPage ? "active" : "");
				html.push(this.pipTemplate.expand(props));
			}
			html = html.join("");
			this.$root.html(html);
			this.asWidget("updateContents");
		},

		clearContents : function() {
			this.$root.html("");
		},

		onPipClicked : function(event, $pip) {
			if (!this.parent) return;

			var page = parseInt($pip.attr("page"));
			if (isNaN(page)) return;
			this.parent.showPage(page);
		}

	});	// end new Class("PagePips")

});	// end define("oak/lib/ui/PagePips")
