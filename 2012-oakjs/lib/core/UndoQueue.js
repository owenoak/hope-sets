/* Copyright (c) 2010-2014  Padopolis Inc.  All rights reserved.

	UndoQueue 	- Stack of actions which have been (or will be) performed.
					- The general case is that we have an "undo" queue which

TODO:  max queue length?

*/

Module.define("oak/lib/core/UndoQueue",
"oak/lib/core/Class,oak/lib/core/Bindable",		/* note: implicit reliance on oak/lib/core/Undoable) */
function(Class, Bindable) {

	var UndoQueue = new Class("UndoQueue", {
		mixins : "Bindable",
//
//	instance methods
//

	//
	//	public API
	//
		init : function(props) {
			this.extend(props);
			this._actions = [];
			this._cursor = 0;
		},


		// Identifying string for the queue.
		// Set up in `UndoQueue.register()`.
		id : undefined,


		// Undo the latest action in the queue.
		// No-op (which shows a warning) if there is no action to be undone in the queue.
		// Returns the return value of the undo call.
		undo : function() {
			var action = this._actions[this._cursor-1];
			if (!action) {
				if (UndoQueue.debug) console.warn("Attempting to undo when no action in queue ", this, " at cursor", this._cursor);
				return undefined;
			}
			this._cursor--;
			if (UndoQueue.debug) console.info(this,".undo()ing action ", action);
			return action._undo();
		},

		// Re-do the latest action in the queue.
		// No-op (which shows a warning) if there is no action to be redone in the queue.
		// Returns the return value of the execute call.
		redo : function() {
			var action = this._actions[this._cursor];
			if (!action) {
				if (UndoQueue.debug) console.warn("Attempting to redo when no action in queue ", this, " at cursor", this._cursor);
				return undefined;
			}
			this._cursor++;
			if (UndoQueue.debug) console.info(this,".redo()ing action ", action);
			return action._redo();
		},


		// Completely re-set the queue.
		// Do this when, eg, you open a new context (eg: file/project/etc)
		reset : function() {
			if (UndoQueue.debug) console.info(this,".reset()");
			this.init();
		},


		// Title of the next action to be undone.
		undoTitle : Property.Getter(function() {
			var action = this._actions[this._cursor-1];
			if (!action) return "(Can't undo)";
			return action.undoTitle;
		}),

		// Title of the next action to be redone.
		redoTitle : Property.Getter(function() {
			var action = this._actions[this._cursor];
			if (!action) return "(Can't redo)";
			return action.redoTitle;
		}),

		// True if we can undo right now.
		canUndo : Property.Getter(function() {
			var action = this._actions[this._cursor-1];
			return !!action;
		}),

		// True if we can redo right now.
		canRedo : Property.Getter(function() {
			var action = this._actions[this._cursor];
			return !!action;
		}),




	//
	//	private API
	//

		// Queue of actions, initialized in `init()`.
		// These actions may or may not have been performed, see `_cursor`.
		_actions : undefined,

		// Index of the next action to be performed in the queue.
		// If we're performing actions normally, this will be `_actions.length`.
		// If we're in the middle of undoing stuff, this may point to an action in the middle of the queue.
		// If we're in a macro set, this may be an action which is the next one to be performed.
		_cursor : 0,

		// Add an action WHICH HAS ALREADY BEEN PEFORMED to this action queue.
		_addAction : function(action) {
			// if our cursor is in the middle of the queue, knock off all actions in the queue after this one.
			if (this._cursor != this._actions.length) {
				this._actions = this._actions.slice(this, this._cursor);
			}
			this._actions.append(action);
			this._cursor = this._actions.length;
			if (UndoQueue.debug) {
				console.group(this,"._addAction(",action,")");
				console.info("    undoTitle: ", this.undoTitle);
				console.info("    redoTitle: ", this.redoTitle);
				console.groupEnd();
			}
//console.info("after _addAction: ",this._actions, this._cursor);
		},


	},
//
//	class methods
//
	{

		// Set to true to print out debugging information.
		debug : false,

		// Registry of named action queues.
		REGISTRY : {},

		// Return an action queue passed:
		//		- type: string		:  name of a pre-defined action queue.  (eg: "undo")
		//		- tyep UndoQueue	:  pointer to an action queue
		get : function(queue) {
			if (queue == null) return undefined;
			if (typeof queue === "string") return UndoQueue.REGISTRY[queue];
			if (queue instanceof UndoQueue) return queue;
			console.warn("Error: UndoQueue.get(",queue,"): queue not understood");
			return undefined;
		},

		// Register a new UndoQueue.
		//	`id` is the id to register under.
		//	`queue` is the UndoQueue in question.  If you don't provide one, we'll make one for you.
		register : function(id, queue) {
			if (typeof id !== "string") throw "UndoQueue.register(): must provide an id";
			if (!queue) queue = new UndoQueue({id:id});
			if (!queue.id) queue.id = id;
			UndoQueue.REGISTRY[id] = queue;
			if (UndoQueue.debug) console.info("UndoQueue.register(",id,",",queue,")");
			return queue;
		}
	});



//
//	Initialization
//

	// Create the "undo" queue.
	window.UndoQueue = UndoQueue.register("undo");

	return UndoQueue;
});	// end define("oak/lib/core/UndoQueue")
