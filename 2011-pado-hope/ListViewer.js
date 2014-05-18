/* 	Single-select list viewer.  
	Define an .rowTemplate to draw for each item or set .columns to create one automatically.
	
	TODO:
		- header row (can we position:fixed it ???)
		- paging/scrolling/etc
		- smart selection semantics
		- observe the list add/remove/etc ?
		- multiple columns
*/

Script.require("{{hope}}Section.js", function(){



new hope.Section.Subclass("hope.ListViewer", {
	tag : "hope-listviewer",
	mixins : "Noticeable",
	properties : {
		onReady : function() {
			this.$rows = this.getChild("rows");
			this.$rows.onChild("row", "click", "onRowClicked", this);
		},

		template : "<hope-container>\
						<rows part='hope-listViewer:$rows'/>\
					</hope-container>",
		
		
		// you can specify custom next/prev buttons by having child elements:
		//		<hope-action part='$prev'.../>
		//		<hope-action part='$next'.../>
		childProcessors : "hope-action:initAction",
		prevButtonTemplate : "<hope-action part='$prev' appearance='black' label='Previous set'/>",
		nextButtonTemplate : "<hope-action part='$next' appearance='black' label='Next set'/>",
		moreButtonTemplate : "<hope-action part='$more' appearance='black' label='More'/>",
		
		// template to draw for each item
		rowTemplate : "<row></row>",
		
		// message to show when no items in the list
		emptyMessage : Attribute({name:"emptyMessage", inherit:true, value:"No items to show"}),	// TODO: translate

		// "itemMode": how to handle more items than will fit:  "all", "window", "more"
		// NOTE: with "all" mode, you'll render ALL of the rows in the list, no matter how long!
		itemMode : Attribute({name:"itemMode", value:"more", update:true, inherit:true}),

		// max number of rows to show -- for itemMode="window" or "more" only
		// TODO:  maxRows of "*" to set maxRows dynamically according to actual size
		maxRows : Attribute({name:"maxRows", type:"number", update:true, inherit:true, value:20}),
		
		// first row we're currently displaying -- for itemMode="window" only
		startRow : Attribute({name:"startRow", type:"number", update:true, inherit:true, value:0}),

		// total rows in our current list (generated, not settable)
		totalRows : Getter(function() {
			return (this.list ? this.list.length : 0);
		}),
		
		// last row we're displaying (generated, not settable)
		endRow : Getter(function() {
			if (this.itemMode == "all") {
				return this.totalRows;
			} else if (this.itemMode == "window") {
				return Math.min(this.startRow + this.maxRows, this.totalRows);
			} else {
				return this.startRow + this.$rows.elements.length;
			}
		}),

		// if true, we're selectable
		selectable : Attribute({name:"selectable", type:"flag", falseIf:[false,"false","no"]}),

		// if true, we automatically deselect when updating the list
		autoDeselect : false,				//TODO attr

		// current sort attribute, takes effect when our list is et
		sortBy : Attribute({name:"sortBy",update:true}),

		// element which shows our # of rows, set a sub-item as a @part='$rowCounter'
		$rowCounter : null,
		
		// message to show in our rowCounter
		rowCountMessage : Attribute({name:"rowCountMessage", inherit:true, value:"{{startRow+1}} to {{endRow}} of {{totalRows}}"}),
		
		// layout style of the list:  "horizontal" or "vertical"
		// if "horizontal", show this as a horizontal list (rather than a vertical list)
		layout : Attribute({name:"layout", value:"vertical", inherit:true, update:true}),

		// type of data:  "object" or "element"
		//	if "object", we treat our .list items as objects which we pull rows/columns from
		//	if "element", we treat our .list items as <element>s which are appended into the rows
		// if "horizontal", show this as a horizontal list (rather than a vertical list)
		dataType : Attribute({name:"dataType", value:"object", inherit:true }),
		
		// .list is the list of data we're pointing to.  When it's changed:
		//		- redraw the list
		list : new InstanceProperty({
			name:"list", 
			onChange : function(newList, oldList) {
				this.startRow = 0;
				
				// clear the selection
				if (this.autoDeselect) this.selectedIndex = -1;
				if (this.sortBy && newList.sortBy) newList.sortBy(this.sortBy);
				
				this.fire("update");
			}
		}),
		
		// Set .columns to a comma-separated list of column names
		//	to generate an rowTemplate of <cells> for those columns automatically.
		//	The class of each column will be set to the column name.
		columns : Attribute({name:"columns", type:"list", value:"", update:true,
			onChange : function(list) {
				var output = ["<row>"];
				if (list) list.forEach(function(column) {
					output.push("<cell class='"+column+"'>{{"+column+"}}</cell>");
				});
				output.push("</row>");
				this.rowTemplate = output.join("");
			}
		}),

		// Return the row element for a given index.
		getRow : function(index) {
			if (this.itemMode === "window") index -= this.startRow;
			return this.$rows.getChildren("row")[index];
		},

		// index of the item in our list which is selected
		selectedIndex : Attribute({name:"selectedIndex", type:"number", 
				update:true, value:-1, inherit:true,
				onChange : function(index) {
//console.warn(this.id+".selectedIndex changed to ",index);				
					this.fixSelectionHighlight();					
					var record = (this.list ? this.list[index] : null);
					this.soon(0, "selectionChanged", record, index);
				}
			}),

		// selection is a pointer to our list item which is selected.
		//	Setting .selection will change the selectedIndex
		selection : Property({
			get : function() {
				return (this.list ? this.list[this.selectedIndex] : undefined);
			},
			set : function(item) {
				var index = (this.list ? this.list.indexOf(item) : -1);
//console.warn(this.id+".selection changing to index "+index, item, this.list);
				this.selectedIndex = index;
			}
		}),
		
		onRowClicked : function(event, row) {
			var index = row.attr("_index");
			if (this.selectable) {
				this.selectedIndex = index;
			}
			this.fire("click", index, this.list[index]);
		},

		
		// full on redraw of the entire list
		onUpdate : function() {
			if (this.list == null || this.totalRows == 0 && this.emptyMessage) {
				this.notice = this.emptyMessage;
				return;
			}
			this.notice = "";
			
//console.info(this.id,"updating, selectedIndex: ",this.selectedIndex, ", length:",this.totalRows);

			// clear the old list items
			this.$rows.empty();

//TODO: show next/prev when not at start/end of list
			
			var index = this.startRow-1, 
				listLength = this.totalRows,
				last = (this.itemMode == "all" ? listLength : Math.min(this.startRow + this.maxRows, listLength))
			;
			while (++index < last) {
				var row = this.getItemRow(index);
				if (row) this.$rows.append(row);
			}
			
			if (this.$rowCounter) {
				var message = this.rowCountMessage.expand(this);
				this.$rowCounter.html = message;
			}
			
			this.updateHighlightAndActions();
		},

		// return a single, expanded outer HTML element that represents a row for the list item
		getItemRow : function(index) {
			var item = this.list[index];
			if (item == null) return null;

			if (this.dataType == "object") {
				return this.rowTemplate.inflateFirst(item);
			} else {
				return item;
			}
		},
		
		// update the row indices to correspond to the list
		updateRowIndices : function() {
			var startRow = this.startRow;
			this.$rows.elements.forEach(function(row, index) {
				row.attr("_index", index+startRow);
			});
		},

		fixSelectionHighlight : function() {
			// clear the old hilight
			var row = this.getChild("rows > *[selected]");
			if (row) row.attr("selected",null);
			
			// show the new highlight
			row = this.getChild("rows *[_index='"+this.selectedIndex+"']");
			if (row) {
				row.attr("selected","yes");
				// make sure the selected row is visible
				this.revealChild(row);
			}
		},
		
		showPrevSet : function() {
			if (this.startRow == 0) return;
			
			this.startRow = Math.max(0, this.startRow - this.maxRows);
			this.fire("update");
			
		},
		
		showNextSet : function() {
			if (this.startRow >= this.totalRows) return;
			
			this.startRow = Math.min(this.startRow + this.maxRows, this.totalRows-1);
			this.soon("update");
		},
		
		scrollToRow : function(index) {	
			if (this.itemMode !== "more") return console.warn("ERROR: scrollToRow() only supported for 'more' itemType");
			
			// insert rows until we get to that item, plus a little bit.
			this.insertMoreRows(index+20);
			if (!this.$rows) return;
			
			// scroll so that item is at the front of the list
			var element = this.$rows.elements[index-1];
			if (element) {
				this.$container.scrollLeft = element.offsetLeft - 10;
				this.$container.scrollTop  = element.offsetTop - 10;
			}
		},


		// Insert more rows into the current data set.
		//	By default, we add `this.maxRows` to the end.
		//  Specify a specific place to stop by passing explicit endRow.
		//
		// NOTE: we assume the display is starting at row 0
		insertMoreRows : function(endRow) {
			// if all displayed, forget it
			if (this.endRow >= this.totalRows-1) return;
			
			// default endRow and pin to the totalRows
			if (endRow == null) endRow = this.endRow + this.maxRows;
			if (endRow > this.totalRows) endRow = this.totalRows;

			// if we're already showing the endRow, forget it
			if (endRow < this.endRow) return;
			
			for (var index = this.endRow; index < endRow; index++) {
				var $row = this.getItemRow(index);
				if ($row) this.$rows.append($row);
			}
			this.updateHighlightAndActions();
		},

		// show the appropriate next/prev/more actions depending on the state of the world
		updateHighlightAndActions : function() {
			this.updateRowIndices();
			this.fixSelectionHighlight();

			if (this.itemMode === "window") {
				if (!this.$prev && this.prevButtonTemplate) {
					this.initAction(this.prevButtonTemplate);
				}
				if (!this.$next && this.nextButtonTemplate) {
					this.initAction(this.nextButtonTemplate);
				}
				if (this.$prev) this.$prev.visible = (this.startRow > 0);
				if (this.$next) this.$next.visible = (this.endRow != this.totalRows);
			} else if (this.itemMode === "more") {
				if (!this.$more && this.moreButtonTemplate) {
					this.initAction(this.moreButtonTemplate);
				}
				if (this.$more) this.$more.visible = (this.endRow != this.totalRows);
			}
		},		
		
		// create custom next/prev/more actions
		initAction : function(action) {
			if (typeof action === "string") action = action.inflateFirst();
			action.owner = this;

			var part = action.attr("part");
			var $rows = this.getChild("rows");

			if (part.contains("prev")) {
				this.$prev = action;
				this.$container.insertBefore(action, $rows);
				action.on("activate", this.showPrevSet.bind(this));
			} else if (part.contains("next")) {
				this.$next = action;
				this.$container.insertAfter(action, $rows);
				action.on("activate", this.showNextSet.bind(this));
			} else if (part.contains("more")) {
				this.$more = action;
				this.$container.insertAfter(action, $rows);
				action.on("activate", function(){this.insertMoreRows()}.bind(this));
			} else {
				console.warn("ListViewer.initAction(): unclear what to do with action", action);
			}
		}
		
	}
});



Script.loaded("{{hope}}ListViewer.js");
});
