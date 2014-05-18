/* Copyright (c) 2010-2014  Padopolis Inc.  All rights reserved.

	Undoable - set of instructions/modifications which are done as a coherent unit.
				Actions are named.
				Actions may be synchronous or asynchronous.
				Actions can be done and undone.
				Actions return a value -- for an asynchronous action, this will be a promise.
				Actions aggregate other low-level operations into a larger framework.
				Actions can be assigned to menu items, buttons or shortcut keys (or all at the same time).
					Invoking an action in any of the above forms is completely equivalent to executing the action manually.
				When actions are executed, they are generally added to ActionQueues -- this provides for, eg, "undo".
				Actions can be recorded in sequence and played back (eg macros).

*/

Module.define("oak/lib/core/Undoable",
"oak/lib/core/Class,oak/lib/core/UndoQueue",
function(Class, UndoQueue) {

	var Undoable = new Class("Undoable", {
	//
	//	public API
	//

		// Method WHICH YOU MUST PROVIDE which accomplishes the action.
		// Accepts variadic parameters, based on what's being performed.
		// Called as an apply on `action.scope`.
		// NOTE: don't call this directly, call `action.execute()` instead.
		doit : undefined,

		// Method WHICH YOU MUST PROVIDE which UN-does the action.
		// Will automatically be passed the same paramters which were passed to the last `doit()` invocation.
		// Called as an apply on `action.scope`.
		// NOTE: don't call this directly, call `actionQueue.undo()` and let that undo for you.
		undo : undefined,

		// internal state of the action.
		//	One of:
		//		- `initialized` 		initialized but not executed yet
		//		- `executed`			has already been executed
		//		- `undone`				has been executed and then later undone
		state : "initialized",

		// Pointer to or id of a global "UndoQueue" of actions which we are a part of.
		// 		- "undo" is the default stack, by placing the action there we can automatically undo it later.
		//		- If you are executing an action as, eg, part of a macro sequence,
		//			assign its actionQueue BEFORE executing it (eg: when initializing).
		// When actions are `execute()`d, they are added to their actionQueue.
		actionQueue : "undo",

		// Scope object for the action.  This is the object the "doit" and "undo" command is `call()`ed on.
		// Defaults to `window` if undefined.
		scope : undefined,


		// Title of this action when it has been executed.
		// Used by the UI to indicate what will be "undone".
		// You action instances should set this to something meaningful.
		undoTitle : "Undo",

		// Title of this action when it has been undone (and is awaiting being redone).
		// Used by the UI to inidicate what will be "redone".
		// You action instances should set this to something meaningful.
		redoTitle : "Redo",


		// Execute this action with the given array of parameters.
		// NOTE: do not override this, override "doit" instead.
		// Automatically records us in our actionQueue (or the default "undoStack" if no actionQueue defined).
		execute : function() {
			try {
				if (this.state !== "initialized") {
					throw "Attempting to execute action which has already been performed.";
				}
				if (typeof this.doit !== "function") throw "No 'doit' function provided for action.";
				if (typeof this.undo !== "function") throw "No 'undo' function provided for action.";
				returnValue = this.doit.apply(this.scope);
			} catch (e) {
				console.group("Error executing action ",this);
				console.error(e);
				if (console.trace) console.trace();
				console.groupEnd();
				throw e;
			}

			this.state = "executed";
			this.addToQueue();

			return returnValue;
		},

		// Add us to our undo queue.
		addToQueue : function() {
			var queue = UndoQueue.get(this.actionQueue);
			if (queue) queue._addAction(this);
		},

		// Pretend to `execute()` this action, without actually calling the `doit` function.
		// Use this rather than `execute()` if you've already accomplished the results before creating the Undoable,
		//	and you want to pretend that the action has executed itself.
		pretend : function() {
			this.state = "executed";
			this.addToQueue();
			return this;
		},

	//
	//	private API
	//


		// Undo this action.  Only valid if the action state is "executed".
		// NOTE: do not override this, override "undo" instead.
		// NOTE: you won't generally call this directly, call `actionQueue.undo()` instead.
		_undo : Property.Hidden(function() {
			try {
				if (this.state !== "executed") throw "Attempting to undo action which has not been executed.";
				returnValue = this.undo.apply(this.scope);
			} catch (e) {
				console.group("Error undoing action ",this);
				console.error(e);
				if (console.trace) console.trace();
				console.groupEnd();
				throw e;
			}
			this.state = "undone";
//console.dir(this);
			return returnValue;
		}),

		// Re-do an action (which has previously been undone) with the original calling parameters.
		// NOTE: you should NEVER override this.
		// NOTE: you won't generally call this directly, call `actionQueue.redo()` instead.
		_redo : Property.Hidden(function() {
			try {
				if (this.state !== "undone") throw "Attempting to redo an action which has not been undone.";
				returnValue = this.doit.apply(this.scope);
			} catch (e) {
				console.group("Error redoing action ",this);
				console.error(e);
				if (console.trace) console.trace();
				console.groupEnd();
				throw e;
			}
			this.state = "executed";
//console.dir(this);
			return returnValue;
		})


	});
	return Class.Undoable;
});	// end define("oak/lib/core/Undoable")
