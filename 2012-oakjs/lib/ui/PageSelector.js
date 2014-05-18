/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	"PageSelector" page indicator -- set of dots which represents a set of pages.
//	Hook this up by giving it a "parent" object which is Pageable.
//

Module.define("oak/lib/ui/PageSelector", "oak/lib/core/Class,oak/lib/ui/Widget", function(Class, Widget) {

	return new Class("PageSelector", "Widget", {
		// Widget who we report paging events to (and who tells us to update).
		parent : undefined,

		events : [
			{ selector : "## *[page]", event:"click", handler:"onPageClicked" }
		],

		// Should we show various bits?
		showFirstPage 		: false,
		showPreviousPage 	: true,
		showPageNumbers 	: true,		// page numbers in the middle
		showNextPage	 	: true,
		showLastPage	 	: false,


		// maximum number of pages to show
		maxPagesToShow		: 10,

		pageNumberTemplate 	: "<span class='Pager PageNumber {{className}}' page='{{page}}'>{{pageName}}</span>",
		firstPageTemplate 	: "<span class='Pager FirstPage {{className}}' page='first'>|&lt;</span>",
		previousPageTemplate: "<span class='Pager PreviousPage {{className}}' page='previous'>&lt; Previous</span>",
		nextPageTemplate 	: "<span class='Pager NextPage {{className}}' page='next'>Next &gt;</span>",
		lastPageTemplate 	: "<span class='Pager LastPage {{className}}' page='last'>&gt;|</span>",


		onReady : function() {
			if (this.parent && this.parent.$root) this.parent.$root.addClass("HasPageSelector");
		},

		// Update to show the correct number of pips when required.
		updateContents : function() {
			var pageCount = (this.parent ? this.parent.pageCount : 0);
			if (pageCount === 0) {
				this.clearContents();
				return;
			}
			var currentPage = this.parent.pageNumber;
			var lastPage = pageCount - 1;

			var html = [];

			// first page selector
			if (this.showFirstPage) {
				html.append(this.firstPageTemplate.expand({page:"first", className:(currentPage == 0 ? "off" : "")}));
			}
			// previous page selector
			if (this.showPreviousPage) {
				html.append(this.previousPageTemplate.expand({page:"previous", className:(currentPage == 0 ? "off" : "")}));
			}
			// page number selectors
	//TODO: limit to a range around the current pageNumber so it's not toooo big
			if (this.showPageNumbers) {
				var startPage = 0,
					endPage = pageCount,
					maxPages = this.maxPagesToShow
				;

				// if we have more pages to show than we can handle...
				if (maxPages && pageCount >= maxPages) {
					// ...center around the current page
					startPage = Math.max(0, currentPage - Math.floor(maxPages/2));
					endPage = Math.min(startPage+maxPages, pageCount);
				}

				for (var page = startPage; page < endPage; page++) {
					var props = {
						page		: page,			// machines start with 0
						pageName	: page+1,		// humans   start with 1
						className 	: (page === currentPage ? "active" : "")
					};
					html.append(this.pageNumberTemplate.expand(props));
				}
			}

			// next page selector
			if (this.showNextPage) {
				html.append(this.nextPageTemplate.expand({page:"next", className:(currentPage == lastPage ? "off" : "")}));
			}
			// last page selector
			if (this.showLastPage) {
				html.append(this.lastPageTemplate.expand({page:"last", className:(currentPage == lastPage ? "off" : "")}));
			}

			html = html.join("");
			this.$root.html(html);
			this.$root.removeClass("empty");
			this.asWidget("updateContents");
		},

		clearContents : function() {
			this.$root.html("");
			this.$root.addClass("empty");
		},

		onPageClicked : function(event, $page) {
			if (!this.parent || this.parent.pageCount == 0) return;

			var page = $page.attr("page");
			var currentPage = this.parent.pageNumber;
			var lastPage = this.parent.pageCount - 1;

			if (page == "first") this.parent.showPage(0);
			if (page == "previous") this.parent.showPage(currentPage-1);
			if (page == "next") this.parent.showPage(currentPage+1);
			if (page == "last") this.parent.showPage(lastPage);

			page = parseInt(page);
			if (!isNaN(page)) this.parent.showPage(page);
		}

	});	// end new Class("PageSelector")

});	// end define("oak/lib/ui/PageSelector")
