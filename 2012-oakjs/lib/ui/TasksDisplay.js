/* Copyright (c) 2010-2014  Padopolis Inc.  MIT License, see: http://opensource.org/licenses/MIT */


/*
	Display a little window with all of the keyboard shortcuts currently in play.
*/

Module.define("oak/lib/ui/TasksDisplay",
"oak/lib/core/TaskList,oak/lib/ui/Panel,oak/lib/ui/Modal",
function(TaskList, Panel, Modal) {

	// Shortcuts overlay singleton
	var TasksDisplay = new Panel({
		id 			: "TasksDisplay",
		title 		: "Happening now:",

	// modal semantics
		mixins 		: "Modal",
		// don't hide when escape pressed or background hit
		onCancel : function() {},

		showTasks : function() {
			if (TaskList.ALL_TASKS.length == 0) {
				this.hide();
			} else {
				if (!this.isShowing) 	this.showModal();
				else					this.updateContents();
			}
		},

		updateContents : function() {
			var html = [];
			var alreadyShown = [];	// keep track of tasks we've already shown
			TaskList.ALL_TASKS.forEach(function(taskList) {
				if (alreadyShown.contains(taskList)) return;
				alreadyShown.append(taskList);
				html.append(this.getTaskListHTML(taskList, alreadyShown));
			}.bind(this));
			html = html.join("\n");
			this.$body.html(html);
		},

		statusHints : {
			unstarted 	: "-",
			pending		: ">",
			resolved	: "✓",
			rejected	: "X"
		},

		getTaskListHTML : function(taskList, alreadyShown) {
			var html = [];
			var listName = (taskList.name || "anonymous");
			var status = (taskList.hasStarted ? taskList.state() : "unstarted");
			var hint = this.statusHints[status];
			html.append("<div class='TaskList' name='"+listName+"' status='"+status+"' hint='"+hint+"'>");
			if (status == "pending") {
				// output completed tasks
				taskList.completedTasks.forEach(function(task) {
					html.append(this.getTaskHTML(task, alreadyShown));
				}.bind(this));

				// output the current task
				if (taskList.currentTask) html.append(this.getTaskHTML(taskList.currentTask, alreadyShown));

				// output tasks still todo
				taskList.tasksToDo.forEach(function(task) {
					html.append(this.getTaskHTML(task, alreadyShown));
				}.bind(this));
			}
			// end the outer taskList
			html.append("</div>");
			return html.join("\n");
		},

		getTaskHTML : function(task, alreadyShown) {
//if (!alreadyShown) debugger;
			if (!task || !task.message) return "";
			// if this is actually a task list, make sure we haven't already output it
			var taskList = undefined;
			if (task.promise) {
				if (task.promise.isATaskList) taskList = task.promise;
				if (task.promise.proxyFor && task.promise.proxyFor.isATaskList) taskList = task.promise.proxyFor;
			}
			if (taskList) {
				// if we have already shown this guy, bail
				if (alreadyShown.contains(taskList)) return "";

				// remember that we've seen it
				alreadyShown.append(taskList);

				// and if it has started, recurse
				if (task.status === "pending") return this.getTaskListHTML(taskList, alreadyShown);
			}

			var hint = this.statusHints[task.status];
			return "<div class='Task' name='"+task.message+"' status='"+task.status+"' hint='"+hint+"'></div>";
		},

	});

	// Take over the `TaskList.showStatus()` call to show running tasks!
	TaskList.showStatus = function() {
		if (!TasksDisplay.$root) TasksDisplay.draw();
		TasksDisplay.showTasks();
	}


	return TasksDisplay;
});	// end define("oak/lib/ui/TasksDisplay")
