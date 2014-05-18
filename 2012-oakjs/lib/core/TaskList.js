/* Copyright (c) 2010-2013  Padopolis Inc.  All rights reserved. */

//
//	A TaskList represents a set of asynchronus "tasks" you want to exectute one after another.
//	Each of your tasks is expected to return a promise which it resolve()s or reject()s itself.
//  Note that this is a 'one shot' interface, much like a jQuery Deferred
//		-- you should create a new TaskList each time you want to do stuff,
//		   rather than attempting to re-use an existing TaskList.
//
//	In fact, the taskList is a instance of Deferred(), so you can do anything with it you'd normally do with a deferred.
//
//	Create a taskList like so:
//		var tasks = new TaskList({scope:someObject});
//
//	The taskList wraps each of the individual promises up in a master promise,
//	 which will be resolve()d if all tasks are completed successfully,
//	 or reject()ed immediately if any of the tasks fail (without invoking subsquent tasks).
//
//	Note that when you `addTask()` you'll specify an identifying message for what this task is accomplishing
//	as well as the method which actually does your task:
//		tasks.addTask("My first step", function(){ return firstStep() });
//		tasks.addTask("My second step", function(resultsOfFirstStep){ return secondStep(resultsOfFirstStep) });
//		...
//		tasks.start();
//
//	The `tasks.start()` line will return the "all done" promise, which you can `.done()` or `.fail()` as you like.
//
//	Note that you can execute a task for each thing in a list (array) with:
//		tasks.forEach(list, "item message with {{substitutions}}", listItemMethod)
//	`listItemMethod` will be called as:
//		listItemMethod.apply(taskList.scope, nextItem)
//

Module.define("oak/lib/core/TaskList", null, function() {

	// Simple Task constructor.
	// NOTE: you can
	var Task = window.Task = function Task(message, method) {
		this.message = message;
		this.method = method;
	}
	Task.prototype = new Task();
	Task.prototype.status = "unstarted";
	Task.prototype._addCallback = function(callback, errback) {
		if (!this.callbacks) 		this.callbacks = {done:[], fail:[]};
		if (callback) this.callbacks.done.append(callback);
		if (errback)  this.callbacks.fail.append(errback);
	};
	Task.prototype.done 	= function(method){this._addCallback(method);};
	Task.prototype.fail 	= function(method){this._addCallback(null, method);};
	Task.prototype.always 	= function(method){this._addCallback(method, method);};
	Task.prototype.then 	= function(callback, errback){this._addCallback(callback, errback);};

	var taskProperties = {
		// overall name for this task
		name : undefined,

		// have we already started?
		hasStarted : false,

		// Current task we're executing.
		currentTask : undefined,

		// List of tasks still to execute, set up in `init()`.
		// We'll pop tasks off this list as we execute them.
		// Array of  { message:, method }
		tasksToDo : undefined,

		// Tasks we've already completed, set up in `init()`.
		completedTasks : undefined,

		// Promise we'll resolve() or reject() when all tasks are done, set up in `init()`.
		allDonePromise : undefined,

		// Scope for applying to all task methods and for reject()ing or resolve()ing the allDonePromise.
		// (Pass in init to set).
		scope : window,

		// Name of a "group" of related tasks.
		// By placing tasks in groups, you can get a unified UI, higher-level "cancel" semantics, etc.
		group : undefined,

		// Message to show when we're starting tasks
		// (Pass in init to set).
		startMessage : undefined,

		// Message to show when we've finished all tasks successfully.
		// (Pass in init to set).
		doneMessage : undefined,

		// Message to show when something failed.
		// (Pass in init to set).
		failMessage : undefined,

		// Delay between tasks, allowing the UI to catch up.
		// Set to 0 to attempt to do tasks WITHOUT allowing the UI time to intervene.
		delayBetweenTasks : 10,

		// Amount of time to display the task as finished
		taskFinishedDelay : 1500,

		// Marker so we know that this Deferred is actually a TaskList.
		isATaskList : true,

	//
	//	start/stop/state
	//

		// What's our state in relation to our `group`?
		//	If we have no `group`, this just returns our normal state.
		//  Otherwise, we check our state relative to our parent tasks in the group and,
		//	if any of those are resolved/rejected, we pass that along.
		groupState : function() {
			var parent = this.parentTask;
			while (parent) {
				var state = parent.state();
				if (state !== "pending") return state;
				parent = parent.parentTask;
			}
			return this.state();
		},

		// Start the tasks which have already been set up.
		start : function() {
			// if we've already started, this is a no-op.
			if (this.hasStarted) return this;

			this.hasStarted = true;
			TaskList.ALL_TASKS.append(this);

			setTimeout(this._doNextTask.bind(this), 0);
			return this;
		},

		_doNextTask : function() {
			// if we're not running, forget it
			if (this.groupState() !== "pending") return;

			// get all of the arguments to pass to the next task.
			var lastTaskResults = Function.args();

			// add the task we've just completed to the completedTasks list
			var task = this.currentTask;
			if (task) {
				this.completedTasks.append(task);
			}

			// get the next task to execute
			task = this.currentTask = this.tasksToDo.shift();

			// if nothing else to do, we're all done!
			if (task == null) {
				return this._completed(lastTaskResults);
			}

			// show the message associated with the task
			task.status = "pending";
			if (task.message) this._notifyProgress(task.message);

			var taskList = this;

			function doit() {
				// call the method
				try {
					var result = task.method.apply(taskList.scope, lastTaskResults);

					// if we got a promise back, continue when that returns
					if (TaskList.isAPromise(result)) {
						// remember the promise made by the current task
						task.promise = result;

						// set status & results immediately
						task.promise.done(function() {
							task.status = "resolved";
							task.results = result;
						});
						task.promise.fail(function() {
							task.staus = "rejected";
						});

						if (task.callbacks) {
							task.promise.always(taskList._resolveTaskCallbacks.bind(taskList, task));
						}

						// if it is a taskList, point back to us!
						// (this helps to cancel sub-tasks when parent tasks are cancelled)
						if (result.isATaskList) {
							result.parentTask = taskList;
						}
						if (result.proxyFor && result.proxyFor.isATaskList) {
//console.warn("found results.dataloader.isATaskList:  ",task.message);
//console.warn(result);
//console.warn(result.dataLoader);
							result.parentTask = taskList;
							result.proxyFor.parentTask = taskList;
						}

						// call ourselves back when the sub-task completes
						result.done(taskList._doNextTask.bind(taskList));
						result.fail(taskList._failed.bind(taskList));
					}
					// if not a promise
					else {
						// execute any callbacks immediately
						task.status = "resolved";
						if (task.callbacks) taskList._resolveTaskCallbacks(task, result);

						// call doNextTask immediately with the result
						taskList._doNextTask.call(taskList, result);
					}
				}
				// if we get an exception
				catch (error) {
					console.error(error);
					// fail the taskList
					taskList._failed(error);
				}
			}

			// use a timer if delayBetweenTasks is > 0, so the UI can catch up
			if (taskList.delayBetweenTasks) {
				setTimeout(doit, taskList.delayBetweenTasks);
			}
			// otherwise do immediately (blocking the UI from updating)
			else {
				doit();
			}
		},

		_resolveTaskCallbacks : function(task, result) {
			var success = (task.status === "resolved");//(TaskList.isAPromise(result) ? result.state() === "resolved" : true);
window.task = task;
console.warn("_resolveTaskCallbacks", arguments, success, task.status);
			var i = -1, callback, callbacks = (success ? task.callbacks.done : task.callbacks.fail);
			while ((callback = callbacks[++i])) {
				try {
					task._currentCallback = callback;
					callback.call(this.scope, result);
				} catch (error) {
					console.group("Error executing callback for ",task);
					console.debug("callback=",callback);
					console.error(error);
					console.groupEnd();

					// fail the taskList
					this._failed(error);
				}
			}
		},

		// Internal method called when we've completed successfully.
		_completed : function(lastTaskResults) {
			// bail if we've already finished
			if (this.state() !== "pending") return;

			// set the status of the current task
			var currentTask = this.currentTask;
			if (currentTask) {
				currentTask.status = "resolved";
			}
			try {
				var promise = $.Deferred().resolve();
				// if someone set up a _successMessage, show that to the user
				if (this._successMessage) {
					// don't show normal finish UI since we're doing an alert
					this.taskFinishedDelay = 0;
					console.info(this._successMessage);
					promise = this.alert(this._successMessage);
				}
				// if someone set up a _successCallback,
				//	execute that and make it's result the lastTaskResults
				if (this._successCallback) {
					promise.done(function() {
						lastTaskResults = this._successCallback.call(this.scope);
						return lastTaskResults;
					}.bind(this));
				}
//console.debug(" resolving with ",lastTaskResults);
				promise.done(function() {
					// convert results to an array if necessary
					if (!Array.isArray(lastTaskResults)) lastTaskResults = [lastTaskResults];
					this.resolveWith(this.scope, lastTaskResults);
				}.bind(this));
			} catch (e){
				console.group("Error in _completed() for ",this);
				console.error(e);
				console.groupEnd();
			}
			this._taskListFinished();
		},


		// Internal method called when something has failed (or we've been cancelled)
		_failed : function(error) {
			// bail if we've already finished
			if (this.state() !== "pending") return;
			var currentTask = this.currentTask;

			var failMessages = [];
			if (currentTask && currentTask.message) 	failMessages.append("Error while " + currentTask.message);
			if (this.failMessage) 						failMessages.append(this.failMessage);
			if (failMessages.length === 0) failMessages[0] = "Unknown error";

			if (!this.failSilently) {
				console.error("Task list _failed:");
				console.warn("  task list: ", this);
				console.warn("  current task: ", currentTask);
				console.warn(failMessages);
			}

			try {
				this.notifyWith(this, failMessages);
			} catch (e) {
				console.error("Error notifying failure for takList ",this, ":", e);
			}

			try {
				this.rejectWith(this.scope, arguments);
			} catch (e) {
				console.error("Error rejecting for takList ",this, ":", e);
			}


			// set the status of the current task
			if (currentTask) {
				currentTask.status = "rejected";

				// if we can cancel the currentTask, do so!
				if (currentTask.promise && currentTask.promise.cancel) {
console.warn("  cancelling subtask ",currentTask.promise);
					currentTask.promise.cancel();
				}
			}
			this._taskListFinished();
		},

		// All tasks were finished (possibly because we were cancelled).
		_taskListFinished : function() {
			// update now, then re-update in a little bit
			TaskList.showStatus();
			TaskList.ALL_TASKS.remove(this);

			// use a timer if delayBetweenTasks is > 0, so the UI can catch up
			if (this.taskFinishedDelay && !this.failSilently) {
				setTimeout(TaskList.showStatus.bind(TaskList), this.taskFinishedDelay);
			}
			// otherwise do immediately (blocking the UI from updating)
			else {
				TaskList.showStatus();
			}
		},

		_notifyProgress : function(message) {
			var notifyee = this, depth = 0;
			// recurse up the parent tree notifying all task lists
			while(notifyee) {
				notifyee.notifyWith(notifyee, ["progress", depth, message]);
				depth++;
				notifyee = notifyee.parentTask;
			}
		},

	//
	//	setting up tasks
	//

		// Add a task to the end of our list of tasks.
		addTask : function(message, method) {
			// handle passing just function with no message
			if (typeof message === "function" && !method) {
				method = message;
				message = null;
			}
			var task = new Task(message, method);
			this.tasksToDo.add(task);
			return task;
		},

		// Execute the method for each item in the list, in order.
		// NOTE: we assume that `list` is an array-like thing,
		//		 	OR
		//		 that list is a function which yields an array-like thing.
		//
		// We assume that method takes a single argument, the item in question, and returns a promise, yadda yadda.
		//
		// Adds this as a single task in the taskList.
		forEach : function(message, list, itemMessage, method) {
			var taskList = this;
			function start() {
				// if list is a function, call it to yield our list
				if (typeof list === "function") list = list();
				if (!list) list = [];

				// create a new task list for the iteration
				var tasks = new TaskList({
					name : message,
					scope : taskList.scope
				});
				list.forEach(function(item, index) {
					var msg;
					if (itemMessage) 	msg = itemMessage.expand(item);
					else				msg = message + " " + index;
//console.info(itemMessage, item, msg);
// TODO: 'msg' below isn't getting the expand()ed string.  WTF???
					tasks.addTask(msg, method.bind(taskList.scope, item, index));
				});
				return tasks.start();
			}

			// add to the global task list
			taskList.addTask(message, start);
		},


		// Keep "doing" some method "while" the return value of the function is truthy.
		// If the return value is a promise, we'll wait to execute the next step until that promise resolves.
		// Otherwise we'll keep right on going.
		//
		// Returns a promise to be resolve()d when the return value is non-empty.
		// If the method throws an error, we'll abort with a reject.
		//
		// Note that we're guaranteed to call the method at least once!
		doWhile : function(message, method) {
			var taskList = this;
			var whilePromise = new $.Deferred();
			function doNext() {
				if (taskList.groupState() !== "pending") return;

				try {
					var result = method.apply(taskList.scope);
				} catch (error) {
					whilePromise.rejectWith(taskList.scope, [error]);
				}

				// if the method returned null, we're done
//console.warn("doWhile returned ",result, " which is truthy? ", !!result);
				if (!result) {
					whilePromise.resolveWith(taskList.scope);
					return;
				}

				function _doNext() {
					// use a timer if delayBetweenTasks is > 0, so the UI can catch up
					if (taskList.delayBetweenTasks) {
						setTimeout(doNext, taskList.delayBetweenTasks);
					}
					// otherwise do immediately (blocking the UI from updating)
					else {
						doNext();
					}
				}

				// otherwise if we got a promise,
				//	call again when that promise completes.
				if (TaskList.isAPromise(result)) {
					result.done(_doNext)
						  .fail(function(error) {whilePromise.rejectWith(taskList.scope, [error])});
				}
				// some other result -- just try again after a short delay (so the UI can catch up)
				else {
					_doNext()
				}
			}

			function start() {
				doNext();
				return whilePromise;
			}

			// add to the global task list
			task = taskList.addTask(message, start);
		},


	//
	//	user interaction
	//

		// Cancel currently executing tasks, rejecting() our allDonePromise.
		// If you pass a `message`, we'll show that to the user.
		// NOTE:  we can't necessarily reliably cancel the task that's running right now,
		//		  but we can at least stop subsequent tasks.
		cancel : function(message, okButtonTitle) {
			if (message) {
				console.warn(message);
				if (typeof message === "string") this.alert(message, okButtonTitle);
			}

			// don't show the normal error data since we were explicitly cancelled
			this.failSilently = true;

			this._failed(message);
			return this;
		},

		// Show a message and/or do some cleanup work on success.
		onSuccess : function(message, callback) {
			this._successMessage = message;
			this._successCallback = callback;
		},


		// Show an alert message to the user.
		// ALWAYS returns a promise.
		// NOTE: if we're in non-interactive mode, we'll skip the alert.
		alert : function(message, okButtonTitle) {
			if (message) {
				console.info(message)
				if (TaskList.interactive) return UI.alert(message, okButtonTitle);
			}
			return $.Deferred().resolve();
		},

		// Add a task to show a confirm message to the user.
		// If they say "no", cancel the rest of the tasks silently.
		// If we're not in interactive mode, just returns a pre-resolved promise
		//	(so we assume the confirmation is always "yes").
		// Returns the task created.
		addConfirm : function(message, okButtonTitle, cancelButtonTitle) {
			var tasks = this;
			return tasks.addTask(message, function() {
				if (typeof message === "function") message = message();

				// if in non-interactive mode, just return a resolved promise
				if (!TaskList.interactive) return $.Deferred().resolve();

				return UI.confirm(message, okButtonTitle, cancelButtonTitle)
						.fail(function(){tasks.cancel()});
			});
		},

		// Add a task to show a prompt message to the user.
		// If they cancel, or if the value returned is empty, we'll cancel the rest of the tasks silently.
		// If we're not in interactive mode, just returns a pre-resolved promise with the defaultValue.
		// Returns the task created.
		addPrompt : function(message, defaultValue, okButtonTitle, cancelButtonTitle, callback) {
			var tasks = this;
			return tasks.addTask(message, function() {
				// if in non-interactive mode, just return a resolved promise
				if (!TaskList.interactive) return $.Deferred().resolve(defaultValue);
				if (typeof defaultValue === "function") defaultValue = defaultValue();

				return UI.prompt(message, defaultValue, okButtonTitle, cancelButtonTitle)
					.fail(function(){tasks.cancel()})
					.done(function(value) {
						if (value === "") return tasks.cancel();
					});
			});
		},

	//
	//	notification
	//
		_notify : function(messageType, depth, message1, message2, etc) {
			if (depth === 0) {
				// only update status UI on actual task list, not parents
				var message = Function.args().splice(0,2).join("<br>");

				this._messageType = messageType;
				this.message = message;
				TaskList.showStatus();
			}
		},

	//
	//	debug
	//
		toString : function() {
			if (this.name) return "[TaskList '"+this.name+"']";
			return "[anonymous TaskList]";
		}


	};	// end taskProperties




	// When invoked, we'll actually create a jQuery Deferred and decorate it.
	var TaskList = function TaskList(properties) {
		var taskList = new $.Deferred();
		for (var key in taskProperties) {
			taskList[key] = taskProperties[key];
		}

		taskList.tasksToDo = [];
		taskList.completedTasks = [];
		taskList.runningSubtasks = [];

		if (properties) {
			for (var key in properties) {
				taskList[key] = properties[key];
			}
		}

		taskList.progress(taskList._notify);

		return taskList;
	};

//
// class-level stuff
//
	// List of ALL tasks currently executing.
	var ALL_TASKS = TaskList.ALL_TASKS = [];

	// Duck-typing to check to see if something is a promise
	TaskList.isAPromise = function(thing) {
		return (thing != null && typeof thing.done === "function" && typeof thing.fail === "function")
	}

	// Default showStatus is a no-op.
	//	Include `oak/lib/ui/TasksDisplay` to show a pretty UI automatically.
	TaskList.showStatus = function(){}

	// Set to false to hide alerts/etc as tasks complete
	//	See `taskList.alert()`
	TaskList.interactive = true;

// debug
window.TaskList = TaskList;

	return TaskList;
});
