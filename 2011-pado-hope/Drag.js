Script.require("", function(){

hope.Draggable = new Observable({

	startDragging : function(event, draggable) {
		if (Event.rightButtonIsDown) return;
			
		this.info = {
			dragTarget : draggable,
			
			startedDragging : false,
		
			globalStartPoint : Event.pagePoint,
			offsetPoint : Event.elementPoint(draggable),
		
			dragMoveHandler : document.body.capture("mousemove", "onDraggableMouseMove", this),
			dragUpHandler : document.body.capture("mouseup", "onDraggableMouseUp", this)
		};
		
		// prevent browser-dragging (eg: when you drag an image)
		event.stop();
	},
	
	moveToEvent : function(event, element) {
		element.left = (event.pageX - this.info.offsetPoint.x);
		element.top = (event.pageY - this.info.offsetPoint.y);
	},

	_call : function(who, methodName, args) {
		if (who && typeof who[methodName] == "function") return who[methodName].apply(who, args);
	},

	// fires while mouse is moving during a (potential) drag operation
	onDraggableMouseMove : function(event) {
//		console.info("global mousemove",event);
		var dragTarget = this.info.dragTarget;
		
		if (!this.info.startedDragging) {
			var delta = Event.pointDelta(this.info.globalStartPoint, Event.pagePoint);
			if (delta.x < 5 && delta.y < 5) {
				return;
			}

			this.info.startedDragging = true;

			// make a proxy to follow the mouse
			var proxy = this.info.dragProxy = this._call(this.info.dragTarget, "makeDragProxy");
			if (proxy) {
				proxy.style.position = "absolute";
				proxy.classList.add("dragging");
				document.body.append(proxy);
			}

			this._call(dragTarget, "onDragStart", [event]);
		}

		// create the dragProxy that we'll move around with the mouse
		var proxy = this.info.dragProxy;
		if (proxy) this.moveToEvent(event, proxy);
		
		var mouseElement = this.info.mouseElement = this.getMouseElement(event);
		var dropTarget = (mouseElement ? mouseElement.selectUp("*[droppable]") : null);

		// send "onDragMove" to the dragTarget
		this._call(dragTarget, "onDragMove", [event, dropTarget, mouseElement]);

		// send "onDrop" calls to the dropTarget (and old dropTarget if necessary)
		var oldDropTarget = this.info.dropTarget;
		this.info.dropTarget = dropTarget;

		if (dropTarget != oldDropTarget) {
			this._call(oldDropTarget, "onDropLeave", [event, dragTarget]);
			this._call(dropTarget, "onDropEnter", [event, dragTarget, mouseElement]);
		}
		this._call(dropTarget, "onDropMove", [event, dragTarget, mouseElement]);
	},
	
	// fires when mouse goes up after going down in us
	onDraggableMouseUp : function(event) {
//		console.info("global mouseup", event);

		// unhook the events
		document.body.un("mousemove", this.info.dragMoveHandler);
		document.body.un("mouseup", this.info.dragUpHandler);

		var dragProxy  = this.info.dragProxy;
		var dragTarget = this.info.dragTarget;
		var dropTarget = this.info.dropTarget;

		// stop dragging the dragProxy
		if (this.info.dragProxy) {
			this.info.dragProxy.classList.remove("dragging");
			
			// if the proxy isn't the same as the dragTarget, just kill the proxy
			if (dragProxy != dragTarget) dragProxy.remove();
		}


		if (this.info.startedDragging) {
			this._call(dragTarget, "onDragEnd", [event, dropTarget, this.info.mouseElement]);
			this._call(dropTarget, "onDrop", [event, dragTarget,]);
		} else {
			this._call(dragTarget, "onClick", [event]);
		}

		// clear the info out for next time
		delete this.info;
	},
		
	// return the element currently under the mouse, excluding the dragProxy
	getMouseElement : function(event) {
		// hide the proxy if necessary so we don't count it
		var proxy = this.info.dragProxy, oldDisplay;
		if (proxy) {
			oldDisplay = proxy.style.display;
			proxy.style.display = "none";
		}

		// get the actual element		
		var element = document.elementFromPoint(event.clientX, event.clientY);

		// and restore the proxy to visibility
		if (proxy) proxy.style.display = oldDisplay;
		
		return element;
	}

});// end new Observable();

Script.loaded("hope.Drag.js");
});
