icon = "Circle";	// icon to be used for new waypints
preface = "NGA:";	//we will identify objects with this preface

// look for expired NGWs
objects = [];	// will be array of objects to delete
now = new Date();
const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

w = 400; h = 70;	// size of form fields
dialogue = [
	{type:"caption", value:"NGA Warnings"},
	{type:"field", label:"Name",width:w},
	{type:"field", label:"Description", multiline:true, width:w, height:h},
	{type:"field", label:"Location(s)", multiline:true, width:w, height:h},
	{type:"field", label:"Expires",width:200},
	{type:"button", label:"enter"},
	{type:"hLine"},
	{type:"button", label:"quit"}
	];

// first waypoint
guids = OCPNgetWaypointGUIDs();
for (i = 0; i < guids.length; i++){
	waypoint = OCPNgetSingleWaypoint(guids[i]);
	name = waypoint.markName;
	if (name.slice(0,4) == preface){ // This is one of ours
		// look for expiry
		description = waypoint.description;
		if (isExpired(description)){
			printOrange("\nWaypoint ",name, "\n", description, "\n");
			waypoint.isWaypoint = true;
			objects.push(waypoint);	// remember for later
			}
		}
	}
//now routes
guids = OCPNgetRouteGUIDs();
for (i = 0; i < guids.length; i++){
	route = OCPNgetRoute(guids[i]);
	name = route.name;
	if (name.slice(0,4) == preface){ // This is one of ours
		// look for expiry
		expires = route.to;
		if (isExpired(expires)){
			printOrange("\nRoute ", name, "\n", route.from, "\n",expires, "\n");
			route.isWaypoint = false;
			objects.push(route);
			}
		}
	}

if (objects.length > 0){
	// there are objects maybe to delete
	yesNo = [
		{type:"caption", value:"NGA Warnings"},
		{type:"text", value:"Delete expired?"},
		{type:"button", label:["Delete","Leave"]}
		]
	onDialogue(deleteObjects, yesNo);
	}
else {
	onDialogue(process, dialogue);
	consoleHide();
	};


function deleteObjects(result){
	button = result[result.length-1].label;
	if (button == "Delete"){	// delete the objects
		while (objects.length > 0){
			thisOne = objects.shift();
			if (thisOne.isWaypoint){
				OCPNdeleteSingleWaypoint(thisOne.GUID);
				print("Deleted waypoint ", thisOne.markName, "\n");
				}
			else {
				OCPNdeleteRoute(thisOne.GUID);
				print("Deleted route ", thisOne.name, "\n");
				}
			}
		}
	onDialogue(process, dialogue);
	consoleHide();
	}

function process(d){
	alert(false);
	button = d[d.length-1].label;
	if (button == "quit") {
		stopScript("");	// quit with no result
		}
	name = d[1].value.trim();
	description = d[2].value.trim();
	locations = d[3].value.trim();
	expires = d[4].value;
	if (expires != ""){
		// have expiry - check it is valiid
		if (expires.match(/\d\d\d\d\d\d[A-Z] [A-Z][A-Z][A-Z] \d\d/) == null)
			alert("Invaid expiry\n");
		}
	if ((name.length == 0) || (locations.length == 0)){
		alert("Name and location required");
		}
	if (alert()){ // Have an error - try again
		// prefill with last entreis
		dialogue[1].value = d[1].value;
		dialogue[2].value = d[2].value;
		dialogue[3].value = d[3].value;
		dialogue[4].value = d[4].value;
		}
	else {			
		if (locations[locations.length-1] == ".") // remove any trailing '.'
			locations = locations.slice(0, -1)
		locations = locations.replace(/[\r\n]/gm, ""); // remove newline chars
		locations = locations.split(",");	// split into array
		if (locations.length == 1){	// just one - will be waypoint
			position = formatPositions(locations[0].trim());
			name = preface + name;
			if (expires.length > 0) description += "\nExpires: " + expires;
			waypoint = {
				position,
				markName:name,
				iconName:icon,
				description:description
				};
			OCPNaddSingleWaypoint(waypoint);
			}
		else {	//multiple positions - create route
			marks = [];
			for (i = 0; i < locations.length; i++){
				position = formatPositions(locations[i].trim());
				mark = {
					position: position,
					markName: ("000" + i).slice(-3),
					iconName: icon,
					GUID: OCPNgetNewGUID()
					}
				marks.push(mark);
				if (i == 0) firstMark = mark;	// remember for closing the loop
				}
			marks.push(firstMark);	// close the route
			route = {
				name: preface + name,
				waypoints: marks,
				from:description,
				to:"Expires: " + expires,
				};
			OCPNaddRoute(route);			
			}
		}
	onDialogue(process, dialogue);
	}

function formatPositions(input){	// turn the NGA position into a JS position
	function formDegs(half){
		parts = half.split("-");
		deg = parts[0];
		min = parts[1]
		hem = min.slice(-1);
		min = min.slice(0, -1);
		result = deg*1 + min/60;
		if ((hem == "S")|| (hem == "W")) result = result*-1;
		return result;
		}
	halves = input.split(" ");
	if (halves.length != 2) throw("Invalid position");
	position = {latitude:formDegs(halves[0]), longitude:formDegs(halves[1])};
	return position;
	}

function isExpired(description){ // examines an expiry and returns true if expired
	if (description == null) return false;
	expiry = description.match(/Expires: *\d\d\d\d\d\d[A-Z] [A-Z][A-Z][A-Z] \d\d/);
	if (expiry == null) return false;	// no expiry found
	expiry = expiry[0].slice(8);	// drop prefix
	day = expiry.match(/\d\d/)[0];
	month = expiry.match(/[A-Z][A-Z][A-Z]/)[0];
	for (m = 0; m < monthNames.length; m++){
		if (month == monthNames[m]) break;
		}
	month = m;
	year = "20" + expiry.slice(-2);
	combined = new Date(year, month, day);
	return (combined < now)? true : false;
	}
