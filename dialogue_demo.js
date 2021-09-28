dialogue = [
	{type:"caption", value:"Boat registration"},
	{type:"text", value:"You may register your boat here", style:{size:16}},
	{type:"field", label:"Boat name", width:250, fieldStyle:{italic:true}},
	{type:"radio", label:"Type", value:["Yacht","Motor cruiser","Keel boat","Dinghy"]},
	{type:"field", label:"Model", },
	{type:"slider", label:"Length (m)", range:[2, 40], value:10},
	{type:"spinner", label:"Draught (decimeters)", range:[10,30], value:20},
	{type:"tickList", label:"Down wind sails", value:["Spinnaker","Cruising 'chute", "Code 0"]},
	{type:"hLine"},
	{type:"tick", value:"*alert on registration?", style:{underline:true}},
	{type:"button", label:["cancel", "*register"]}
	];
onDialogue(handle, dialogue);

function handle(response){
	switch(response[response.length-1].label){
	case "cancel":
		scriptResult("Registration was cancelled");
		return;
	case "register":
		string = "Boat name: " + response[2].value;
		string += "\n" + "Type: " + response[3].value;
		string += "\n" + "Model: " + response[4].value;
		string += "\n" + "Length: " + response[5].value + "m Draught: " + (response[6].value/10).toFixed(2) + "m";
		sailList = response[7].value;
		if (sailList.length > 0){
			string += "\nDown wind sails: ";
			for (i = 0; i < sailList.length; i++) string += sailList[i] + " + ";
			string = string.slice(0, -3);	// drop final ' + '
			}
		if (response[9].value) alert(string);
		print(string, "\n");
		scriptResult("Registration complete");
		return;
		}
	}