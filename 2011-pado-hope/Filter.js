/* FilterField: 
	[x] Label  [ operator v] [ value ]
*/

Script.require("{{hope}}Element-attach.js", function(){


new Element.Subclass("hope.Filter", {
	tag : "hope-filter",
	properties : {
		onReady : function() {
			// set up events
		},
		
		$clauses : Children("hope-filter-clause"),

		// possible parameters that we deal with as:  <field>:{type:"<type>",title:"<title>"}
		parameterSet  : InstanceProperty({
			name : "parameterSet",
			onChange : function(parameterSet) {
				// clear all the old clauses
				this.clearClauses();
				this.makeClause();
			
				// create a new lcause
				this.addNewClause();
				this.onFilterChanged();
			}
		}),

		
		// event handlers
		
		onFilterChanged : function() {
			// HACKY:  set a css class on our element so we know how many clauses they are for visual appearance
			var $clauses = this.$clauses;
			this.className = "clauses_"+$clauses.length;

//			console.warn("filterChanged to: ",this.tastyValue);
		},
		
		onClearPressed : function($clause) {
			if (this.$clauses.length <= 1) return;
			$clause.remove();
			this.onFilterChanged();
		},
		
		onAdderPressed : function() {
			this.addNewClause();
			this.onFilterChanged();
		},
		
		addNewClause : function(param, operator, value) {
			var $clause = this.makeClause(param, operator, value);
			this.append($clause);
			return $clause;
		},
		
		clearClauses : function() {
			this.$clauses.forEach(function($clause){$clause.remove()});
		},
		
		makeClause : function(param, operator, value) {
			var $clause = new hope.FilterClause({$filter:this, parameterSet:this.parameterSet});

			// if no parameter specified, set to the next unused parameter
			if (!param) {
				$clause.parameter = this.getNextUnusedParameter();
			} else {
				// attempt to set to the parameter passed in
				$clause.parameter = param;
				if ($clause.parameter == param) {
					// if we successfully set to that parameter
					if (operator) $clause.operator = operator;
					if (value != undefined) $clause.value = value;
				}
			}
			return $clause;
		},
		
		// get the next parameter that's not in use right now
		getNextUnusedParameter : function() {
			if (!this.parameterSet) return;
			var list = Object.keys(this.parameterSet);
			this.$clauses.forEach(function($clause) {
				var param = $clause.parameter;
				list.remove(param);
			});
			// reset if we get back to 0
			if (list.length == 0) list = Object.keys(this.parameterSet);
			return list[0];
		},
		
		tastyValue : Property({
			get : function() {
				var params = [];
				this.$clauses.forEach(function($clause) {
					var value = $clause.tastyValue;
					if (value) params.push(value);
				});
				return params.join("&");
			}, 
			
			set : function(value) {
				this.clearClauses();
				(value||"").split("&").forEach(function(clause) {
					var match = this.splitTastyClause(clause);
					if (match && this.parameterSet[match.parameter]) this.addNewClause(match.parameter, match.operator, match.value);
				}, this);
				this.onFilterChanged();
			}
		}),
		
		splitTastyClause : function(clause) {
			var match = clause.match(/(\w+)__(\w+)=(.*)/);
			if (!match) {
				console.warn(this, "attempted to set tastValue to invalid value '"+value+"'");
				return;
			}
			return {
						parameter : match[1],
						operator : match[2],
						value : match[3]
					};
		}
	}
}),

new Element.Subclass("hope.FilterClause", {
	tag : "hope-filter-clause",
	properties : {
		// set things up and do the initial update when ready
		onReady : function() {
			if (!this.$filter) this.$filter = this.selectUp("hope-filter");

			this.updateParameterSet();
			
			// set up events
			this.$clearBtn.on("activate", this.onClearPressed, this);
			this.$parameter.on("change", this.onParameterChanged, this);
			this.$operator.on("change", this.onOperatorChanged, this);
			this.$adder.on("activate", this.onAdderPressed, this);

			this.$value.on({
				scope : this,
				keypress : "onInputKeyPressEvent",
				change : "onInputChangeEvent",
				focus : "onInputFocusEvent",
				blur : "onInputBlurEvent"
			});
		},
		
		template : "<hope-action icon='field-clear-white' part='$clearBtn'/>\
					<select class='parameter' part='$parameter'/>\
					<select class='operator' part='$operator'/>\
					<input class='value' part='$value' />\
					<hope-action icon='silk-add' part='$adder' />",

		textOperators : {
			"icontains"	: "contains",
			"exact"		: "is"
		},
		
		numberOperators : {
			"lte"		: "<=",
			"lt"		: "<",
			"exact"		: "=",
			"gt"		: ">",
			"gte"		: ">="		
		},
		
		status : Attribute({name:"status",update:true}),
		
		// possible parameters that we deal with as:  <field>:{type:"<type>",title:"<title>"}
		updateParameterSet  : function() {
			var parameterSet = this.parameterSet;
			if (!parameterSet) return;
			var paramOptions = {};
			for (var parameter in parameterSet) {
				paramOptions[parameter] = (parameterSet[parameter].title || parameter);
			}
			if (this.$parameter) this.$parameter.setOptions(paramOptions);
			this.parameter = Object.keys(paramOptions)[0];
		},

		// parameter we save as.  When this is changed, we set up the operator fields
		parameter : InstanceProperty({
			name : "parameter",
			onChange : function(parameter) {
				if (!this.parameterSet) return;
				
				var details = this.parameterSet[parameter];
				if (!details) {
					parameter = Object.keys(this.parameterSet)[0];
					details = this.parameterSet[parameter];
				}

				this.$parameter.value = parameter;
				this.type = details.type;

				this.$operator.visible = !!details;
				this.$value.visible = !!details;

//HMMM...
				this.soon("valueChanged");
			}
		}),

		// parameter type:  "text" or "number"
		type : InstanceProperty({
			name : "type",
			onChange : function(type, oldType) {
				if (type != oldType) this.value = "";
				
				// update the $operator select
				var operatorSet = (type == "text" ? this.textOperators : this.numberOperators);
				this.$operator.setOptions(operatorSet);
				
				// make sure we have a valid operator selection
				var operator = this.operator;
				if (operatorSet[operator] == null) operator = null;
				if (!operator) this.operator = Object.keys(operatorSet)[0];
			}
		}),

		// operator:  values depend on .type
		operator : InstanceProperty({
			name : "operator",
			onChange : function(operator) {
				this.$operator.value = operator;
			}
		}),

		// value to match against
		value : InstanceProperty({
			name : "value",
			onChange : function(value) {
				this.$value.value = value;
			}
		}),

		keypressDelay : 500,
		
		
		onUpdate : function() {
			console.warn(this, "onupdate");
		},


		// setting up the parameter list
		updateParameters : function() {
			if (!this.parameterSet) return;
			
		},


		// event handlers

		onClearPressed : function(event) {
			this.$filter.onClearPressed(this);
		},
		
		onAdderPressed : function(event) {
			this.$filter.onAdderPressed(event);
		},

		onParameterChanged : function(event) {
			this.parameter = this.$parameter.value;
			this.soon(0,"valueChanged");		
		},

		onOperatorChanged : function(event) {
			this.operator = this.$operator.value;
			this.soon(0,"valueChanged");		
		},

		onInputKeyPressEvent : function(event) {
			this.soon(this.keypressDelay,"valueChanged");
		},
		
		onInputChangeEvent : function(event) {
			this.soon(0,"valueChanged");
			return true;
		},
		
		onInputFocusEvent : function(event) {
			this.classList.add("focus");
		},
		
		onInputBlurEvent : function(event) {
			this.classList.remove("focus");
		},
		
		// fired when the input value changes
		onValueChanged : function(event) {
			var tasty = this.tastyValue;
			this.status = (tasty ? "ok" : "error");
			this.$filter.onFilterChanged();
		},


		// django/tastypie parameter value
		tastyValue : Property({
			get : function() {
				if (this.$value.value == "") return;
				var value = this.parameter + "__" + this.operator + "=" + this.$value.value;
				return value;			
			}, 
			
			set : function(value) {
				var match = this.$filter.splitTastyClause(value);
				if (!match) {
					console.warn(this, "attempted to set tastValue to invalid value '"+value+"'");
					return;
				}
				this.parameter = match.parameter;
				this.operator = match.operator;
				this.value = match.value;
			}
		})
	}
});



Script.loaded("{{hope}}Filter.js");
});
