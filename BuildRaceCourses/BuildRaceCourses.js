//	This script for the JavaScript plugin provides creation of racing routes by selecting race marks from a list
//	being a subset of OpenCPN waypoints

Position = require("Position");
//	declare enduring variables
var routeName;
var replaceRoute;
var pattern;
var waypoints = [];	// to be array of waypoints
var routeList = [];	// array of pre-existing routes in OpenCPN
var routeGUID;		// the GUID for the route being created
var markList = [];	// array of mark names to offer
var routeMarks = [];	// will be a list of the route marks
var passingSide = [];	// side to pass waypoint
var pluginConfig;	// plugin configuration

// the dialogues
config = [
	{type:"caption", value:"Race route creator configuration"},
	{type:"text", value:"Enter a pattern for the waypoints to be included in the racemark list\nThis can be a regular expression.\
\nThe example matches all waypoints with names starting with 'Start', 'Finish' and RM\n(Leave blank to include all waypoints)"},
	{type:"field", label:"Pattern", value:"^(Start|Finish|RM)", width:300},
	{type:"hLine"},
	{type:"field", label:"Route name", width:200},
	{type:"tick", value:"*Replace any existing route matching name"},
	{type:"button", label:["Exit", "*Build route"]}
	];

markSelector = [
	{type:"caption", value:"Race mark selector"},
	{type:"radio", label:"Marks", value:[""]},
	{type:"text", value:"Add and next"},
	{type:"button", label:["to port + next", "next", "to starboard + next"]},
	{type:"text", value:"Add last + build"},
	{type:"button", label:["to finish"]},
	{type:"hLine"},
	{type:"button", label:["build", "done"]}
	];

errorDisplay = [
	{type:"caption", value:"Configuration error"},
	{type:"text", value:""},
	{type:"button", label:"*Try again"}
	];

try {pluginConfig = OCPNgetPluginConfig();}
catch(err){
	throw("Script requires plugin v0.3 or greater");
	}
OCPNonMessageName(handleRL, "OCPN_ROUTELIST_RESPONSE");
OCPNsendMessage("OCPN_ROUTELIST_REQUEST", JSON.stringify({"mode": "Not track"}));
consoleHide();
// end of main script

function handleConfig(response){
	waypoints.length = 0;	// clear out
	routeMarks.length = 0;
	markList.length = 0;
	configError = false;
	action = response[response.length-1].label;
	if (action == "Exit"){
		scriptResult("exited");
		return;
		}
	pattern = response[2].value;
	config[2].value = pattern;	// remember for next time in config
	if (pattern != "") pattern = new RegExp(pattern);
	routeName = response[4].value;
	config[4].value = routeName;
	replaceRoute = response[5].value;

	// check out the route
	if (routeName ==""){
		message = "Requires route name to build\n";
		errorDisplay[1].value = "Requires route name to build";
		onDialogue(handleMessageDone, errorDisplay);	// back to user
		return;
		}
	routeGUID = "";
	if (replaceRoute){
		count = 0;
		for (i = 0; i < routeList.length; i++){
			if (routeList[i].name == routeName){
				routeGUID = routeList[i].GUID;
				count++;
				}
			}
		if (count > 1){ // trying to replace route but more than one
			errorDisplay[1].value = "More than one existing route with name " + routeName + " ambiguous!";
			onDialogue(handleMessageDone, errorDisplay);	// back to user
			return;
			}
		if (count == 0) replaceRoute = false;
		}

	// establish racepoints
	waypointGUIDs = OCPNgetWaypointGUIDs();
	if (waypointGUIDs.length == 0) throw("No waypoints found");
	for (i = 0; i < waypointGUIDs.length; i++){
		waypoint = OCPNgetSingleWaypoint(waypointGUIDs[i]);
		if (typeof pattern == "string") waypoints.push(waypoint);
		else if (pattern.test(waypoint.markName)){
			// check if we have already seen this markName.  Don't duplicate.
			duplicate = false;
			for (j = 0; j < waypoints.length; j++){
				if (waypoints[j].markName == waypoint.markName){
					duplicate = true;
					continue;
					}
				}
			if (!duplicate)waypoints.push(waypoint);
			}
		}

	if (waypoints.length == 0){
		message = "No waypoints match selection\n";
		configError = true;
		}
	else if (waypoints.length > 50){
		message = "More than 50 waypoints match selection\n";
		configError = true;
		}
	if (configError){
		errorDisplay[1].value = message
		onDialogue(handleMessageDone, errorDisplay);	// try again
		}
	else {	// good to go
		for (i = 0; i < waypoints.length; i++){
			markList.push(waypoints[i].markName);
			}
		markSelector[1].value = markList;
		onDialogue(handleRoute, markSelector);
		}
	}

function handleRoute(response){
	var markName;
	action = response[response.length-1].label;
	switch(action){
	case "to port + next":
		markName = response[1].value;
		routeMarks.push(markName);
		passingSide.push("to port");
		onDialogue(handleRoute, markSelector);
		break;
	case "next":
		markName = response[1].value;
		routeMarks.push(markName);
		passingSide.push("");
		onDialogue(handleRoute, markSelector);
		break;
	case "to starboard + next":
		markName = response[1].value;
		routeMarks.push(markName);
		passingSide.push("to starboard");
		onDialogue(handleRoute, markSelector);
		break;
	case "to finish":
		markName = response[1].value;
		routeMarks.push(markName);
		passingSide.push("to finish");
		buildRoute();
		break;
	case "build":
		buildRoute();
		break;
	case "done":
		onDialogue(handleConfig, config);
		break;
		}
	}

function buildRoute(){
	var positions = [];	// waypoint positions
	var route = {name:routeName, GUID:routeGUID, from:"", to:"", waypoints:[]};
	var listString = "";
	var maxLength = 0;
	var distance = 0;
	hadError = false;
	for (i = 0; i < routeMarks.length; i++) {
		index = markList.indexOf(routeMarks[i]);
		if (index < 0) throw("Logic error - mark name " + routeMarks[i] + " lost\n");
		waypoint = Object.assign({}, waypoints[index]);	// make copy of this waypoint
		route.waypoints.push(waypoint);
		positions.push(new Position(waypoint.position));	// remeber its position
		maxLength = Math.max(maxLength, routeMarks[i].length); // maxlength of waypoint name
		}
	for (i = 0; i < routeMarks.length; i++) {
		// build in ListString the table to display
		padded = (routeMarks[i] + "                                       ").slice(0, maxLength+1);
		if (i == 0) vectorString = "                  ".slice(0,11);	// blank vector
		else {
			vector = OCPNgetVectorPP(positions[i-1],positions[i]);
			distance += vector.distance;
			vectorString = ("000" + vector.bearing.toFixed(0)).slice(-3) + String.fromCharCode(176) + " " + ("   " + vector.distance.toFixed(1)).slice(-4) + "nm";
			}
		listString += (i + " " + vectorString + " " + padded + passingSide[i] + "\n");
		}
	listString.slice(0, -1);	// drop the last newline
	// create or update route in OpenCPN
	if (replaceRoute){
		try {
			OCPNupdateRoute(route);
			}
		catch(err){
			// error probably route does not exist
			OCPNaddRoute(route);
			}
		}
	else {			
		routeGUID = OCPNaddRoute(route);
		routeList.push({name:routeName, GUID:routeGUID});	// add to list of route marks
		}
	// display route		
	onDialogue(handleMessageDone, [
		{type:"caption", value:"Route " + routeName + " (" + distance.toFixed(1) + "nm)"},
		{type:"text", value:listString, style:{font:"courier"}},
		{type:"button", label:"Dismiss"}
		]);
	}

function handleMessageDone(){
	onDialogue(handleConfig, config);	// try again
	}

function handleRL(routeListJS){	// receive list of routes in JSON and build index
	var i;
	if (routeListJS == null) routeList.length = 0;	// no routes
	else {
		routeList = JSON.parse(routeListJS);
		if (routeList != null) {
			if (routeList.length > 1){  // (changed from 0 because null entry when no routes)
				if (!routeList[0]) routeList.shift(); // drop first null entry - don't know why it is there
				}
			}
		}
	onDialogue(handleConfig, config);
	}
