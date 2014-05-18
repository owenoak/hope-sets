/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	Generic viewer for a PAGED list-like collection (eg: a PagedCollection).
//	You MAY get away with not subclassing this if you're not doing anything fancy.
//
// 	NOTE: you can add a decorator to one of these (eg: oak/lib/ui/PageSelector)
//			and it will iterate through the pages for you.
//

Module.define("oak/lib/ui/PagedCollectionListViewer",
"oak/lib/ui/CollectionListViewer",
function(CollectionListViewer) {
	return new Class("PagedCollectionListViewer", CollectionListViewer,
	// instance properties
	{

		// pass pageNumber, pageSize, pageCount through to our collection
		pageNumber : Property.DelegatedAlias("pageNumber", "collection", null, {writable:false}),
		pageSize   : Property.DelegatedAlias("pageSize", "collection", null, {writable:false}),
		pageCount  : Property.DelegatedAlias("pageCount", "collection", null, {writable:false}),


		// Show a particular page of results
		showPage : function(pageNumber) {
			if (!this.collection) return;
			this.collection.loadPage(pageNumber);
		}

	});	// end new Class("PagedCollectionListViewer")
});