/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */

//
//	An Uploader is a widget which presents a drag-and-drop file upload interface.
//	You can drag one file at a time (???) and it shows a progress bar while the file is uploading.
//  It emits the following events:
//		- uploadStarted()
//		- uploadProgress()
//		- uploadComplete()
//


Module.define("oak/lib/ui/Uploader",
"oak/lib/core/Class,oak/lib/core/Property,oak/lib/ui/Widget,oak/lib/3rdParty/jquery.filedrop/jquery.filedrop",
function(Class, Property, Widget, filedrop) {
	new Class("Uploader", "Widget", {

		// set to true to debug upload events
		debug : false,

		// Upload to a temp file?
		uploadToTempFile : false,

		// HTML element(s) to drop on.
		// If undefined, we'll use our $root.
		$dropTarget : undefined,

		// Message to show while we're awaiting upload
		awaitingDragMessage : "Drop here to upload...",

		// Message to show while we're awaiting upload
		readyToDropMessage : "Let go to upload!",

		// Message to show while upload is progressing
		progressMessage : "Upload is {{complete}}% complete",

		// Message to show when upload completes
		completionMessage : "Upload complete!",

		// template to use as HTML for the panel by default
		widgetTemplate : "<div id='{{id}}' class='{{className}} Uploader'>{{awaitingDragMessage}}</div>",

		// root path where all files are stuck
		rootPath : "_studio/media/",

		// Options to pass to the jquery.filedrop thinger.
		// NOTE: all of the methods we care about will be shuttled through to our `onXXX` methods,
		//		 so override those method handlers rather than putting functions in here.
		//
		// SEE: https://github.com/weixiyen/jquery-filedrop
		fileDropOptions : Property.ProtoMap("fileDropOptions", {
				// POST parameter name used on serverside to reference file
				paramname: "file",

				// make a cross-origin request with cookies
//				withCredentials: true,

				// Send additional request headers
				headers: {
					'enctype': 'multipart/form-data'
				},

				allowedfiletypes: ['image/jpeg','image/png','image/gif'],   // filetypes allowed by Content-Type.  Empty array means no restrictions
				maxfiles: 25,		// max # of files to drop at once (????)
				maxfilesize: 20,	// max file size in MBs
		}),

		onReady : function() {
			if (this.uploadToTempFile) {
				this.fileDropOptions.url = "dyn/api/publisher/uploadtemp/";
			} else {
				this.fileDropOptions.url = function() {return this.uploadUrl}.bind(this);
			}

			// set up method handlers in the fileDropOptions
			// SEE: https://github.com/weixiyen/jquery-filedrop
			Property.extend(this.fileDropOptions, {
				dragOver: this.bind("onDragOver"),
				dragLeave: this.bind("onDragLeave"),
				docOver: this.bind("onDocOver"),
				docLeave: this.bind("onDocLeave"),
				drop: this.bind("onDrop"),
				beforeEach: this.bind("onBeforeEach"),
				beforeSend: this.bind("onReadyToSendFile"),
				uploadStarted: this.bind("onFileUploadStarted"),
				uploadFinished: this.bind("onFileUploadFinished"),
				progressUpdated: this.bind("onFileProgressUpdated"),
				globalProgressUpdated: this.bind("onGlobalProgressUpdated"),
				speedUpdated: this.bind("onSpeedUpdated"),
				rename: this.bind("getServerPathForFile"),
				afterAll: this.bind("onUploadFinished"),
				error : this.bind("onFileError"),
			});
			var $target = this.$dropTarget || this.$root;
			$target.filedrop(this.fileDropOptions);
		},

		// user dragging files anywhere inside the browser document window
		onDocOver: function() {
	//		if (this.debug) console.warn(this, ".onDocOver(", arguments, ")");
			this.$root.addClass("dragging");
		},
		// user dragging files out of the browser document window
		onDocLeave: function() {
	//		if (this.debug) console.warn(this, ".onDocLeave(", arguments, ")")
			this.$root.removeClass("dragging");
		},

		// User dragged files over our $root.
		onDragOver : function() {
			this.$root.html(this.readyToDropMessage.expand(this));
			this.$root.addClass("active");
		},

		// User dragged files away from our $root.
		onDragLeave : function() {
			this.$root.html(this.awaitingDragMessage.expand(this));
			this.$root.removeClass("active");
		},

		// User dropped file(s) on our $root.
		onDrop : function() {
			if (this.debug) console.info(this, ".onDrop(", arguments, ")")
			this.dropFiles = [];
			this.$root.removeClass("active")
					  .removeClass("dragging")
					  .addClass("uploading");

			$(this).triggerHandler("uploadStarted");
		},

		// called for each file after drop and before beforeSend
		// file is a file object
		// return false to cancel upload
		onBeforeEach : function(file) {
			if (this.debug) console.warn(this, ".onBeforeEach(", arguments, ")");
		},

		// about to send a particular file
		// file is a file object
		// fileIndex is the file index
		// NOTE: call done() to start the upload
		onReadyToSendFile : function(file, fileIndex, done) {
			if (this.debug) console.debug(this, ".onReadyToSendFile(", arguments, ")");
			this.dropFiles[fileIndex] = file;
			done();
		},


	// fileIndex = index => 0, 1, 2, 3, 4 etc
	// file is the actual file of the index
	// len = total files user dropped

		// a file began uploading
		onFileUploadStarted : function(fileIndex, file, len) {
			if (this.debug) console.debug(this, ".onFileUploadStarted(", arguments, ")")
			$(this).triggerHandler("fileUploadStarted", [file, fileIndex]);
		},

		// response is the data you got back from server in JSON format.
		onFileUploadFinished : function(fileIndex, file, response, time, request) {
			if (this.debug) console.debug(this, ".onFileUploadFinished(", arguments, ")")
			$(this).triggerHandler("fileUploadFinished", [file, fileIndex]);
		},

		// this function is used for large files and updates intermittently
		// progress is the integer value of file being uploaded percentage to completion
		onFileProgressUpdated : function(fileIndex, file, progress) {
			$(this).triggerHandler("fileUploadProgress", [progress, file, fileIndex]);
		},

		// progress for all the files uploaded on the current instance (percentage)
		// ex: $('#progress div').width(progress+"%");
		onGlobalProgressUpdated : function(progress) {
			if (this.debug) console.debug(this, ".onGlobalProgressUpdated(", arguments, ")");
			this.complete = progress;
			this.$root.html(this.progressMessage.expand(this));
			$(this).triggerHandler("uploadProgress", [progress]);
		},

		// speed in kb/s
		onSpeedUpdated: function(fileIndex, file, speed) {
//			if (this.debug) console.debug(this, ".speedUpdated(", arguments, ")")
		},

		// name in string format
		// must return alternate name as string
		getServerPathForFile : function(fileName) {
			var path = this.rootPath + fileName;
			if (this.debug) console.warn(this, ".getServerPathForFile(", arguments, "): returning ", path)
			return path;
		},

		// runs after all files have been uploaded or otherwise dealt with
		onUploadFinished: function() {
			if (this.debug) console.debug(this, ".onUploadFinished(", arguments, ")");
			this.$root.html(this.completionMessage.expand(this));
			this.soon(function(){
				this.$root.removeClass("uploading");
				this.$root.html(this.awaitingDragMessage.expand(this));
			}, 1);

			$(this).triggerHandler("uploadFinished", [this.dropFiles]);

			this.dropFiles = null;
		},

		// Error handling
		onFileError: function(err, file, fileIndex) {
			if (this.debug) console.debug(this, ".onFileError(", arguments, ")");
			switch(err) {
				case 'BrowserNotSupported':
					alert('browser does not support html5 drag and drop')
					break;

				case 'TooManyFiles':
					// user uploaded more than 'maxfiles'
					break;

				case 'FileTooLarge':
					// program encountered a file whose size is greater than 'maxfilesize'
					// FileTooLarge also has access to the file which was too large
					// use file.name to reference the filename of the culprit file
					break;

				case 'FileTypeNotAllowed':
					// The file type is not in the specified list 'allowedfiletypes'
					UI.alert("Sorry, that type of file is not allowed.");

				case 'Not Found':
					// 404
					break;

				default:
					break;
			}
		},
	});	// end new Class("Uploader")

	return Class.Uploader;
});	// end define("oak/lib/ui/Uploader")
