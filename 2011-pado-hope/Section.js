/* Section.  Can have header/footer/bodies */

Script.require("{{hope}}Panel.js", function(){


new hope.Panel.Subclass("hope.Section", {
	tag : "hope-section",
	mixins : "Noticeable",
	properties : {
		template : "<hope-container/>",

		childProcessors : "hope-header:initHeader,hope-footer:initFooter,hope-toolbar:initToolbar",

		label 			: Attribute("label"), 

		// Header goes on top, above the container.
		//	put a <headder/> element in your template to put it somewhere else
		initHeader : function(header) {
			if (Element.debug) console.info(this, "processing header", header, this.$container);
			var templateHeader = this.getChild("hope-header");
			if (templateHeader) {
				templateHeader.parentNode.replaceChild(header, templateHeader);
			} else {
				this.$container.parentNode.insertBefore(header, this.$container);
			}
			this.classList.add("hasHeader");
			this.$header = header;
		},
		
		// Footer goes on bottom, below the container.
		//	put a <footer/> element in your template to put it somewhere else
		initFooter : function(footer) {
			if (Element.debug) console.info(this, "processing footer", footer);
			var templateFooter = this.getChild("hope-footer");
			if (templateFooter) {
				templateFooter.parentNode.replaceChild(footer, templateFooter);
			} else {
				this.$container.parentNode.insertAfter(footer, this.$container);
			}
			this.classList.add("hasFooter");
			this.$footer = footer;
		},

		// Toolbar goes on top, below the header by default
		//	put a <toolbar/> element in your template to put it somewhere else
		initToolbar : function(toolbar) {
			if (Element.debug) console.info(this, "processing toolbar", toolbar);
			var templateToolbar = this.getChild("hope-toolbar");
			if (templateToolbar) {
				templateToolbar.parentNode.replaceChild(toolbar, templateToolbar);
			} else {
				this.$container.parentNode.insertBefore(toolbar, this.$container);
			}
			this.classList.add("hasToolbar");
			if (!this.$toolbar) this.$toolbar = toolbar;
		}
	}
});



Script.loaded("{{hope}}Section.js");
});
