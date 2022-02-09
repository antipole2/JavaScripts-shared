preface = "NGA:";	//we will identify objects with this preface
// look for expired NGWs
now = new Date();
const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
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
			}
		}
	}
		
dialogue = [
	{type:"caption", value:"NGA Warnings"},
	{type:"field", label:"Name",width:300},
	{type:"field", label:"Description", multiline:true, width:300, height:50},
	{type:"field", label:"Location(s)", multiline:true, width:300, height:50},
	{type:"field", label:"Expires",width:200},
	{type:"button", label:"enter"}
	]


onDialogue(process, dialogue);

function process(d){
	alert(false);
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
				iconName:"Hazard",
				description:description
				};
			OCPNaddSingleWaypoint(waypoint);
			print("Created waypoint");
			}
		else {	//multiple positions - create route
			marks = [];
			for (i = 0; i < locations.length; i++){
				position = formatPositions(locations[i].trim());
				mark = {
					position: position,
					markName: ("000" + i).slice(-3),
					iconName: "Circle",
					GUID: OCPNgetNewGUID()
					}
				marks.push(mark);
				}
			route = {
				name: preface + name,
				waypoints: marks,
				from:description,
				to:"Expires: " + expires,
				};
			OCPNaddRoute(route);	
			print("Created route\n");			
			}
		}
	onDialogue(process, dialogue);
	}

function formatPositions(input){
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

function isExpired(description){
	// examines a description and returns true if expired
	if (description == null) return false;
	expiry = description.match(/Expires: \d\d\d\d\d\d[A-Z] [A-Z][A-Z][A-Z] \d\d/);
	if (expiry.length == 0) return false;	// no expiry found
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