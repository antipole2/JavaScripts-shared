// Waypoint, route and track housekeeper v 0.1

// Options
nearby = 0.05;	//two points this close in nm regarded as at same position

var log = false;
var doSaves = true;

// action definitions
none = Symbol("None");
update = Symbol("Update");
remove = Symbol("Remove");

caption = {type:"caption", value:"Housekeeper"};

// enduring variables
var wpGUIDs = [];
var rtGUIDs = [];
var tkGUIDs = [];
var allpoints = [];
var routes = [];
var routepoints = [];
var wpUnnamedIndex = [];
var rtUnnamedIndex = [];
var tkUnnamedIndex = [];
var waypointNameDuplicateClusters = [];
var routeNameDuplicateClusters = [];
var rtGotoIndex = [];
var removedRoutePointsIndex = [];
var issues;	// cont of issues found
var changes;	// count of chnages made
var waypointsInRoutesCount;	// number of waypoints that are also in a route
var sucessiveRoutePointClusters = [];
var locations = [];	// points organised by location
var points = [];
var wpOrphaned = 0;
var savedData;		// used to save something during dialogues - what varies on use

// button names for dialogues
buttonQuit =		"Quit";
buttonSkip = 		"Skip";
buttonSkipAll = 	"Skip all";
buttonSave = 		"Save";
buttonDeleteSelected = 	"Delete selected";
buttonKeepAll = 	"Keep all";
buttonWpUnnamed = 	"Name unnamed waypoints";
buttonRtUnnamed = 	"Name unnamed routes";
buttonTkUnnamed = 	"Name unnamed tracks";
buttonWpDuplicates = "Uniquify waypoint names";
buttonRtDuplicates = "Uniquify route names";
buttonGoto = 		"Remove goto routes";
buttonRemoveRemoved = "Remove points removed from routes";
buttonShare =		"Share"
buttonSuccessiveRoutepoints = "Remove successive repeated routepoints";
buttonReanalyse =	"Reanalyse";

// classification of location clusters
// The order is used for sorting
classifications = {
MW0:{order:1, desc:"Multiple waypoints not used in any route"},
SWn:{order:2, desc:"Single waypoint and multiple points"},
MW1:{order:3, desc:"Multiple waypoints and one or more used in a route"},
MWn:{order:4, desc:"Multiple waypoints not used but other routepoints"},
WP0:{order:5, desc:"Multiple routepoints with no waypoints"}
}


var hint = "\nResult of action will be displayed in output pane\nActions will not affect OpenCPN itself unless confirmed later";

Position = require("Position");

// work starts here
config = OCPNgetPluginConfig();
version = config.versionMajor + config.versionMinor/10
if (version < 0.5) throw("Housekeeper requires plugin v0.5 or later");

load();

analyse();

if (report()) whatToDoA();

function load(){	// loads data from OCPN
	allpoints = [];
	routes = [];
	wpguids = OCPNgetWaypointGUIDs();
	if (log) print("wpguids length: ", wpguids.length, "\n");
	if (wpguids.length > 0){
		for (i = 0; i < wpguids.length; i++){
			point =  OCPNgetSingleWaypoint(wpguids[i]);
			point.uses = [];
			point.action = none;
			allpoints.push(point);
			}
		}

	rtguids = OCPNgetRouteGUIDs();
	if (rtguids.length > 0){
		for (i = 0; i < rtguids.length; i++){
			route =  new OCPNgetRoute(rtguids[i]);
			route.action = none;
			routes.push(route);
			}
		}
	if (log) print("Finished loading\n");
	}

function analyse(){	// analyse what we have in OpenCPN
	issues = 0;
	changes = 0;
	waypointsInRoutesCount = 0;
	waypointsInRoute = [];
	waypointsNotInRoute = [];

	if (log){
		print(allpoints.length, " points\n");
		print(routes.length, " routes\n");
		}

	allpoints.sort(function(a, b){	// sort on mark names and put routepints after waypoints with same name
		if (b.markName < a.markName) return 1;
		if (b.markName > a.markName) return -1;
		if (!b.isFreeStanding && a.isFreeStanding) return -1; 
		if (b.isFreeStanding && !a.isFreeStanding) return 1;
		return 0;
		});
	if (log) print("Sorted all points\n");
		
	// check for and index unnamed waypoints
	wpUnnamedIndex = [];		// unnamed waypoints
	removedRoutePointsIndex = [];	// routepoints likely removved from route
	for (i = 0; i < allpoints.length; i++){	// initial scan of points and set up extra attributes
		allpoints[i].uses = [];
		point = allpoints[i];
		point.colocated = false;
		if (point.isFreeStanding && (point.markName.length == 0)) wpUnnamedIndex.push(i);
		if (
			(point.routeCount == 0) && 
			(point.markName.length == 3) && 
			!isNaN(Number(point.markName)) &&
			(point.action == none)
			) removedRoutePointsIndex.push(i);
		}
	if (log) {
		print("wpUnnamedIndex: ", wpUnnamedIndex, "\n");
		print("removedRoutePointsIndex: ", removedRoutePointsIndex, "\n");
		}
		
	// look for duplicate waypoint names ignoring routepoints and build clusters
	waypointNameDuplicateClusters = [];
	for (i = 1; i < allpoints.length; i++){
		if ((allpoints[i].markName == allpoints[i-1].markName) && allpoints[i].isFreeStanding && allpoints[i-1].isFreeStanding){
			cluster = [];
			cluster[0] = i-1; cluster[1] = i;
			while (i < allpoints.length-1){	// check for yet another
				if ((allpoints[i].markName == allpoints[i+1].markName) && allpoints[i+1].isFreeStanding){
					i++;
					cluster.push(i);
					}
				else break;
				}
			if (allpoints[i].markName.length >  0) {
				waypointNameDuplicateClusters.push(cluster);
				}
			}
		}
	
	// now for the routes
	routes.sort(function(a, b){	// sort on route names
		if (b.name < a.name) return 1;
		if (b.name > a.name) return -1;
		return 0;
		});	
	// check for and index unnamed routes and goto routes
	rtUnnamedIndex = [];
	rtGotoIndex = [];
	for (i = 0; i < routes.length; i++){
		if (routes[i].name.length == 0) rtUnnamedIndex.push(i);
		if (
			(routes[i].name.startsWith("Go to ")) &&
			(routes[i].waypoints.length == 2) &&
			(routes[i].action == none)) rtGotoIndex.push(i);
		}	
	// look for duplicate route names and build clusters
	routeNameDuplicateClusters = [];
	for (i = 1; i < routes.length; i++){
		if (routes[i].name == routes[i-1].name){
			cluster = [];
			cluster[0] = i-1; cluster[1] = i;
			while (i < routes.length-1){	// check for yet another
				if (routes[i].name == waypoints[i+1].name){
					i++;
					cluster.push(i);
					}
				else break;
				}
			if (routes[i].name.length >  0) {
				routeNameDuplicateClusters.push(cluster);
				}
			}
		}
	if (log) print("routeNameDuplicateClusters:", routeNameDuplicateClusters, "\n");

	// any successive repeated routepoints
	sucessiveRoutePointClusters = [];
	for (i = 0; i < routes.length; i++){
		cluster = {};	// cluster of repeated routepoints
		cluster.routeKey = i;
		cluster.indexes = [];
		lastGUID = routes[i].waypoints[0].GUID;	// GUID of first routepoint
		for (p = 1; p < routes[i].waypoints.length; p++){ // starting at 2nd routepoint
			point = routes[i].waypoints[p];
			if (point.GUID == lastGUID){
				cluster.indexes.push(p);
				}
			lastGUID = point.GUID;
			routepoints.push(point);
			}
		if (cluster.indexes.length > 0){
			sucessiveRoutePointClusters.push(cluster);	// if we formed a cluster, add it to array
			}
		}
	if (log) print("sucessiveRoutePointClusters: ", sucessiveRoutePointClusters, "\n");

	// now to add route usages to allpoints
	for (r = 0; r < routes.length; r++){	// for each route
		route = routes[r];
		for (p = 0; p < route.waypoints.length; p++){ // for each point in each route
			guid = route.waypoints[p].GUID;
			// find the allpoints index
			for (i = 0, found = false; i < allpoints.length; i++){
				if (guid == allpoints[i].GUID){
					found = true;
					break;
					}
				}
			if (!found) throw("analyse logic error - waypoint not found");
			allpoints[i].uses.push({route:r, leg:p});	// add this use
			}
		}	

	locations = [];	// group marks by location
	for (m = 0; m < allpoints.length; m++){
		loc = {};
		loc.marks = [];
		loc.names = [];
		loc.indexes = [];
		loc.wpNames = [];
		loc.wpIndexes = [];
		mark = allpoints[m];
		if (mark.colocated) continue;	// already assigned this one to a location
		loc.position = mark.position;
		loc.names.push(mark.markName);
		loc.indexes.push(m);
		if (mark.isFreeStanding){	// keep a separate record of free-standing waypiunts
			loc.wpNames.push(mark.markName);
			loc.wpIndexes.push(m);
			}
		mark.colocated = true;
		loc.marks.push(mark);
		for (j = m+1; j < allpoints.length; j++){ // rest of marks
			if (allpoints[j].colocated) continue; // skip this one if already allocated to location
			if (OCPNgetVectorPP(allpoints[m].position , allpoints[j].position).distance < nearby){	// is co-located
				mark = allpoints[j];
				loc.indexes.push(j);
				if (mark.isFreeStanding){	// keep separate record of free-standing waypoints
					loc.wpNames.push(mark.markName);
					loc.wpIndexes.push(j);
					}
				mark.colocated = true;
				loc.marks.push(mark);
				}
			}
		locations.push(loc);
		}
	if (log) print("Built ", locations.length, " locations\n");


	// we are not interested in any locations with only one mark - drop them
	for (i = locations.length-1; i >= 0; i--){
		if (locations[i].marks.length < 2){	// this location has only one mark
			locations.splice(i, 1);	// remove it
			}
		}
	if (log) print("Locations after thinning ", locations.length, "\n");
	// classify the location clusters
	for (i = locations.length-1; i >= 0; i--){
		loc = locations[i];
		usesCount = 0;
		wpsUsed = 0;
		for (m = 0; m < loc.marks.length; m++){
			mark = loc.marks[m];
			usesCount += mark.uses.length;
			if (mark.isFreeStanding)  wpsUsed += mark.uses.length;	// waypoint uses
			}
		if (loc.wpIndexes.length == 0) loc.classification = classifications.WP0;
		else if (usesCount == 0) loc.classification = classifications.MW0;
		else if ((loc.wpIndexes.length == 1) && (usesCount > 0)) loc.classification = classifications.SWn;
		else if ((loc.wpIndexes.length > 1) && (wpsUsed > 0)) loc.classification = classifications.MW1;
		else if (loc.wpIndexes.length > 1)	loc.classification = classifications.MWn;
		else {
			printRed(i, "\tunlassified\tusesCount:", usesCount, "\twpIndex.length:",loc.wpIndexes.length, " wpsUsed:", wpsUsed, "\n",loc, "\n");
			throw("analysis location classification logic error");
			}
		}
	locations.sort(function(a, b){	// sort on classification
		if (b.classification.order < a.classification.order) return 1;
		if (b.classification.order > a.classification.order) return -1;
		return 0;
		});
	if (log) print("Locations classified\n");	
	issues += wpUnnamedIndex.length +  wpOrphaned + waypointNameDuplicateClusters.length + removedRoutePointsIndex.length +
		rtUnnamedIndex.length + rtGotoIndex.length + routeNameDuplicateClusters.length +
		sucessiveRoutePointClusters.length + locations.length;
	if (log){
		print("wpUnnamedIndex.length\t", wpUnnamedIndex.length, "\n");
		print("wpOrphaned\t", wpOrphaned, "\n");
		print("waypointNameDuplicateClusters.length\t", waypointNameDuplicateClusters.length, "\n");
		print("removedRoutePointsIndex.length\t", removedRoutePointsIndex.length, "\n");
		print("rtUnnamedIndex.length\t", rtUnnamedIndex.length, "\n");
		print("rtGotoIndex.length\t", rtGotoIndex.length, "\n");
		print("routeNameDuplicateClusters.length\t", routeNameDuplicateClusters.length, "\n");
		print("sucessiveRoutePointClusters.length\t", sucessiveRoutePointClusters.length, "\n");
		print("locations.length\t", locations.length, "\n");
		}
	}

function report(){	// report on what we have found
	printUnderlined("\nStatistics\n");
	waypointCount = 0; routepointCount= 0; waypointsInRoutesCount = 0;
	for (i = 0; i < allpoints.length; i++){
		if (allpoints[i].isFreeStanding) {
			waypointCount++;
			if (allpoints[i].routeCount > 0) waypointsInRoutesCount++;
			}
		else routepointCount++
		}
	print(allpoints.length, s("\tpoint",allpoints.length), "\n");
	if (waypointsInRoutesCount == 0) print("None are included in any route\n");
	else if (waypointsInRoutesCount == 1) print("of which one is included in one or more routes\n");
	else print("of which ", waypointsInRoutesCount, " are included in one or more routes\n");
	print(rtguids.length, s(" route",rtguids.length), "\n");
		
	if (!issues) printGreen("\nNo issues found\n");
	else {
		printOrange("\n", issues, s(" issue", issues), " found\n");
		printUnderlined("\nIssues\n");
		}
	if (wpUnnamedIndex.length > 0) print(wpUnnamedIndex.length, s(" waypoint", wpUnnamedIndex.length)," unnamed\n");
	if (wpOrphaned){
		printOrange("Warning: ", wpOrphaned, s("waypoint", wpOrphaned), " are orphaned - please report\n");
		}
	if (waypointNameDuplicateClusters.length > 0){
		print("\nDuplicate waypoint names:\ncount\twaypoint name\n");
		for (i = 0; i < waypointNameDuplicateClusters.length; i++){
			cluster = waypointNameDuplicateClusters[i];
			print(cluster.length, "\t\t'", allpoints[cluster[0]].markName, "'\n");

			}
		}

	if (rtUnnamedIndex.length > 0) {
		print("\n", rtUnnamedIndex.length, s(" route", rtUnnamedIndex.length), " unnamed\n");
		}
	if (rtGotoIndex.length > 0) {
		print("\n", rtGotoIndex.length, s(" route", rtGotoIndex.length)," named 'Go to...', with just two points and likely obsolete\n");
		for (i = 0; i < rtGotoIndex.length; i++) print(routes[rtGotoIndex[i]].name, "\n");
		}
	if (removedRoutePointsIndex.length> 0){
		print("\n", removedRoutePointsIndex.length, s(" waypoint", removedRoutePointsIndex.length), " likely removed ", s("routepoint", removedRoutePointsIndex.length), " and not in any route\n");
		for (i = 0; i < removedRoutePointsIndex.length; i++) {
			point = allpoints[removedRoutePointsIndex[i]];
			print(point.markName, " at ",
			formattedPosition(point.position), "\n");
			}
		}

	if (routeNameDuplicateClusters.length > 0){
		print("\nDuplicate route names:\ncount\troute name\n");
		for (i = 0; i < routeNameDuplicateClusters.length; i++){
			cluster = routeNameDuplicateClusters[i];
			print(cluster.length, "\t\t'", routes[cluster[0]].name, "'\n");
			}
		}
	if (sucessiveRoutePointClusters.length > 0){
		printOrange("\nWarning: successive repeated routepoints in ", sucessiveRoutePointClusters.length, s(" route", sucessiveRoutePointClusters.length), "\n");
		for (i = 0; i < sucessiveRoutePointClusters.length; i++){
			cluster = sucessiveRoutePointClusters[i];
			route = routes[cluster.routeKey];
			printOrange("Route '", route.name, "' repeats previous routemark for ", s("leg", cluster.indexes.length), " ");
			for (p = 0; p < cluster.indexes.length; p++){
				printOrange(cluster.indexes[p], " ");
				}
			printOrange("\n");
			}
		}

	lastClassification = -1;
	if (locations.length > 0){	// display location clusters
		print("\nThere are multiple different points located within ", nearby, "nm of each other\nRP = routepoint  WP = waypoint\n");
		for (i = 0; i < locations.length; i++){
			location = locations[i];
			if (location.classification != lastClassification){
				printUnderlined("\n", location.classification.desc, "\n");
				lastClassification = location.classification;
				}
			else print("\n");
			print( i, "\tAt ", formattedPosition(location.position), "\n");
			print(formatLocation(location), "\n");
			}
		}
	return issues;
	}

function whatToDoA(){	// decide next action
	dialogue = [
		caption,
		{type:"text", value:"Choose actions to prepare"}
		];
		
	totalToDo = wpUnnamedIndex.length + rtUnnamedIndex.length + tkUnnamedIndex.length
		+ waypointNameDuplicateClusters.length + routeNameDuplicateClusters.length + rtGotoIndex.length;
	if (totalToDo > 0 ){	// have unnamed objects
		dialogue[1].value = "Act on issues - " + (issues - changes) + " outstanding" + hint;
		hint = "";
		if (wpUnnamedIndex.length > 0) dialogue.push({type:"button", label:buttonWpUnnamed});
		if (rtUnnamedIndex.length > 0) dialogue.push({type:"button", label:buttonRtUnnamed});
		if (tkUnnamedIndex.length > 0) dialogue.push({type:"button", label:buttonTkUnnamed});
		if (waypointNameDuplicateClusters.length > 0) dialogue.push({type:"button", label:buttonWpDuplicates});
		if (routeNameDuplicateClusters.length > 0) dialogue.push({type:"button", label:buttonRtDuplicates});
		if (rtGotoIndex.length > 0) dialogue.push({type:"button", label:buttonGoto});
		if (removedRoutePointsIndex.length > 0) dialogue.push({type:"button", label:buttonRemoveRemoved});
		if (sucessiveRoutePointClusters.length > 0) dialogue.push({type:"button", label:buttonSuccessiveRoutepoints});

		dialogue.push({type:"button", label:[buttonSkip]});
		onDialogue(doNaming, dialogue);
		}
	else whatToDoB("");
	}

function doNaming(dialogue){
	function wpInUse(proposedName){
		for (j = 0; j < allpoints.length; j++){
			if (allpoints[j].markName == proposedName) return true;
			}
		return false;
		}
	function rtInUse(proposedName){
		for (j = 0; j < routes.length; j++){
			if (routes[j].name == proposedName) return true;
			}
		return false;
		}
	button = dialogue[dialogue.length-1].label;
	if (button == buttonQuit) stopScript();
	else if (button == buttonSkip) whatToDoB("");
	else if (button == buttonWpUnnamed){	// name unnamed waypoints
		suffix = 1;
		print("\n");
		while (wpUnnamedIndex.length > 0){	// make sure name not already used
			newName = "Waypoint_" + suffix;
			while (wpInUse(newName)){
				newName = "Waypoint_" + ++suffix;
				}		
			// here because have not found a match with proposed name
			i = wpUnnamedIndex.shift();
			allpoints[i].markName = newName;
			allpoints[i].action = update;
			print("Unnamed waypoint to be named '", newName, "'\n");
			suffix++;
			changes ++;
			}
		whatToDoA();
		}
	else if (button == buttonRtUnnamed){	// name unnamed routes
		suffix = 1;
		print("\n");
		while (rtUnnamedIndex.length > 0){	// if have from or to, build on that - make sure name not already used
			newName = "Route " + suffix;
			i = rtUnnamedIndex.shift()
			if (routes[i].from.length != 0) newName = "From " + routes[i].from;
			if (routes[i].to.length != 0){
				if (routes[i].from.length != 0) newName += " ";
				newName += "To " + routes[i].to;
				}
			if (newName.length == 0) newName = "Route " + suffix++;
			while (rtInUse(newName)){
				newName = "Route_" + suffix++;
				}		
			// here because have not found a match with proposed name
			routes[i].name = newName;
			routes[i].action = update;
			changes ++;
			print("Unnamed route to be named '", newName, "'\n");
			}
		whatToDoA();
		}
	else if (button == buttonWpDuplicates){	// make waypoint names unique
		print("\n");
		while (waypointNameDuplicateClusters.length > 0){
			cluster = waypointNameDuplicateClusters.shift();
			suffix = 1;
			name = allpoints[cluster[0]].markName;
			for (i = 0; i < cluster.length; i++){
				newName = name + "_" + suffix;
				while (wpInUse(newName)){
					newName = name + "_" + ++suffix;
					}
				// have unique name
				allpoints[cluster[i]].markName = newName;
				allpoints[cluster[i]].action = update;
				changes ++;
				print("Waypoint '", name, "' to be renamed '", newName, "'\n");
				}
			}
		whatToDoA();
		}
	else if (button == buttonRtDuplicates){	// make route names unique
		print("\n");
		while (routeNameDuplicateClusters.length > 0){
			cluster = routeNameDuplicateClusters.shift();
			suffix = 1;
			name = routes[cluster[0]].name;
			for (i = 0; i < cluster.length; i++){
				newName = name + "_" + suffix;
				while (rtInUse(newName)){
					newName = name + "_" + ++suffix;
					}
				// have unique name
				routes[cluster[i]].name = newName;
				routes[cluster[i]].action = update;
				changes ++;
				print("Route '", name, "' to be renamed '", newName, "'\n");
				}
			}
		whatToDoA();
		}
	else if (button == buttonGoto){	// remove goto routes
		print("\n");
		while (rtGotoIndex.length > 0){
			i = rtGotoIndex.shift();
			routes[i].action = remove;
			changes ++;
			print("Route  '", routes[i].name, "' will be deleted\n");
			}
		whatToDoA();
		}
	else if (button == buttonRemoveRemoved){	// remove removed points
		print("\n");
		while (removedRoutePointsIndex.length > 0){
			i = removedRoutePointsIndex.shift();
			allpoints[i].action = remove;
			changes ++;
			print("Waypoint  '", allpoints[i].markName, "' at ", formattedPosition(allpoints[i].position),  " will be deleted\n");
			}
		whatToDoA();
		}
	else if (button == buttonSuccessiveRoutepoints){	// remove repeating successive routepoints
		print("\n");
		while (sucessiveRoutePointClusters.length > 0){
			cluster = sucessiveRoutePointClusters.shift();
			for (p = cluster.indexes.length-1; p > -1; p--){	// we work backwards while removing elements
				routes[cluster.routeKey].waypoints.splice(cluster.indexes[p], 1);
				}
			print("Successive repeating routepoint(s) to be removed from route '", routes[cluster.routeKey].name, "'\n");
			routes[cluster.routeKey].action = update;
			changes ++;
			if (routes[cluster.routeKey].waypoints.length < 2){ // now have singleon route
				print("Route  '", routes[cluster.routeKey].name, "' will be deleted as only one routepoint left\n");
				routes[cluster.routeKey].action = remove;
				}
			}
		print("Rebuilding indexes\n");	// removing routepoints screws the indexes - so rebuild
		analyse();
		whatToDoA();
		}
	}

function whatToDoB(lastButton){
	if (lastButton == buttonSkipAll) saveDialogue();
	else {
		hadAction = false;
		for (L = 0; L < locations.length; L++){
			loc = locations[L];
			if (loc.classification.order == 1){ // this location has only unused waypoints - could delete some
				dialogue = [
					caption,
					{type: "text", value: (issues - changes) + " issues outstanding"},
					{type: "text", value:"At " + formattedPosition(location.position) + "\n" + loc.classification.desc},
					{type: "text", value:"Choose which to delete"},
					{type: "tickList", value: loc.wpNames},
					{type: "button", label:[buttonDeleteSelected, buttonKeepAll]}
					];
				savedData = {};	// need to keep extra information to process this dialogue
				savedData.locationIndex = L;
				savedData.wpNames = loc.wpNames;
				savedData.wpIndexes = loc.wpIndexes;
				savedData.dialogue = dialogue;
				onDialogue(deleteWaypoints, dialogue);
				hadAction = true;
				return;
				}
			else if (loc.classification.order == 2){	// just one true waypoint at this location - offer to use it
				dialogue = [
					caption,
					{type: "text", value: (issues - changes) + " issues outstanding"},
					{type: "text", value:"At " + formattedPosition(location.position) + "\n" + loc.classification.desc},
					{type:"text", value:formatLocation(loc)},
					{type:"text", value:"Share WP '" + loc.wpNames + "' for all points?"},
					{type: "button", label:[buttonShare, buttonSkip, buttonSkipAll]}
					];
				savedData = {};	// need to keep extra information to process this dialogue
				savedData.dialogue = dialogue;
				savedData.wpNames = loc.wpNames;
				savedData.locationIndex = L;
				savedData.wpIndexes = loc.wpIndexes;
				onDialogue(shareWaypoint, dialogue);
				hadAction = true;
				return;
				}
			else if ((loc.classification.order == 3) || (loc.classification.order == 4)){	// multiple waypoints - select which to use
				dialogue = [
					caption,
					{type: "text", value: (issues - changes) + " issues outstanding"},
					{type: "text", value:"At " + formattedPosition(location.position) + "\n" + loc.classification.desc},
					{type:"text", value:formatLocation(loc)},
					{type:"text", value:"Select waypoint to use for all points?"},
					{type:"radio", value: loc.wpNames},
					{type: "button", label:[buttonShare, buttonSkip, buttonSkipAll]}
					];

				savedData = {};	// need to keep extra information to process this dialogue
				savedData.dialogue = dialogue;
				savedData.wpNames = loc.wpNames;
				savedData.locationIndex = L;
				savedData.wpIndexes = loc.wpIndexes;
				onDialogue(shareOneofSeveralWaypoints, dialogue);
				hadAction = true;
				return;
				}
			else  if (loc.classification.order == 5){	// multiple points but no waypoint - select which to use
				dialogue = [
					caption,
					{type: "text", value: (issues - changes) + " issues outstanding"},
					{type: "text", value:"At " + formattedPosition(location.position) + "\n" + loc.classification.desc},
					{type:"text", value:formatLocation(loc)},
					{type:"text", value:"Select routepoint to use for all points?"},
					{type:"spinner", range: [1,loc.marks.length],label:"Choose by row number"},
					{type: "button", label:[buttonShare, buttonSkip, buttonSkipAll]}
					];

				savedData = {};	// need to keep extra information to process this dialogue
				savedData.dialogue = dialogue;
				savedData.indexes = loc.indexes;
				savedData.locationIndex = L;
				onDialogue(shareOneofSeveralRoutepoints, dialogue);
				hadAction = true;
				return;
				}
			else throw("whatToDoB classication unexpected");
			}
		if (!hadAction) saveDialogue();
		}
	}

function deleteWaypoints(dialogue){
		location = locations[savedData.locationIndex];
		button = dialogue[dialogue.length-1].label;
		alert(false);
		if (button == buttonDeleteSelected){
			selection = dialogue[dialogue.length-3].value;
			if (selection.length < 1) {
				alert("Select at least one");
				onDialogue(deleteWaypoints, savedData.dialogue);
				return;
				}
			indexes = [];
			for (i = 0; i < savedData.wpNames.length; i++){
				indexes[i] = false;
				for (b = 0; b < selection.length; b++){
					if (savedData.wpNames[i] == selection[b]) indexes[i] = true;
					}
				}
			// have array of indexes to remove
			for (i = 0; i < indexes.length; i++){
				if (indexes[i] == true){
					waypoint = allpoints[savedData.wpIndexes[i]];	// waypoint to be deleted
					waypoint.action = remove;
					changes ++;
					print("Will delete waypoint '", waypoint.markName, "'\n");					
					}
				}
			}
		locations.splice(savedData.locationIndex, 1); // finished with this location
		whatToDoB(button);	// next please
		}

function shareWaypoint(dialogue){
	button = dialogue[dialogue.length-1].label;
	if (button == buttonShare){
		if (savedData.wpNames.length != 1) throw("shareWaypoint logic error 1");
		loc = locations[savedData.locationIndex];
		waypoint = allpoints[savedData.wpIndexes[0]];
		print("Will share waypoint '", waypoint.markName, "'\n");
		for (m = 0; m < loc.marks.length; m++){
			mark = loc.marks[m];
			for (u = 0; u < mark.uses.length; u++){
				route = routes[mark.uses[u].route];
				leg = mark.uses[u].leg;
				if (waypoint.GUID != route.waypoints[leg].GUID){
					route.waypoints[leg] = waypoint;
					route.action = update;
					changes ++;
					print("replacing mark ", padString("'"+ mark.markName + "'", 12) , " in leg ", padString(leg,3), " of '",route.name, "'\n");
					}
				}
			}			
		}
	locations.splice(savedData.locationIndex, 1); // finished with this location		
	whatToDoB(button);	// next please
	}

function shareOneofSeveralWaypoints(dialogue){
	button = dialogue[dialogue.length-1].label;
	if (button == buttonShare){
		if (savedData.wpNames.length < 2) throw("shareWaypoint logic error 2");
		selection = dialogue[dialogue.length-3].value;
		for (i = 0; i < savedData.wpNames.length; i++){
			if (savedData.wpNames[i] == selection) break;
			}
		loc = locations[savedData.locationIndex];
		waypoint = allpoints[savedData.wpIndexes[i]];
		print("Will share waypoint '", waypoint.markName, "'\n");
		changesBefore = changes;
		for (m = 0; m < loc.marks.length; m++){
			mark = loc.marks[m];
			for (u = 0; u < mark.uses.length; u++){
				route = routes[mark.uses[u].route];
				leg = mark.uses[u].leg;
				if (waypoint.GUID != route.waypoints[leg].GUID){
					route.waypoints[leg] = waypoint;
					route.action = update;
					changes ++;
					print("replacing mark '"+ mark.markName + "' in leg ", padString(leg,3), " of '",route.name, "'\n");
					}
				}
			}
		if (changes == changesBefore){
			printOrange("No changes needed - consider deleting waypoint(s) ");
			for (m = 0; m < loc.marks.length; m++){
				if (loc.marks[m].uses.length == 0) printOrange("'",loc.marks[m].markName, "' ");
				}
			print("\n");
			}
		}
	locations.splice(savedData.locationIndex, 1); // finished with this location
	whatToDoB(button);	// next please
	}

function shareOneofSeveralRoutepoints(dialogue){
	alert(false);
	button = dialogue[dialogue.length-1].label;
	if (button == buttonShare){
		index = dialogue[dialogue.length-3].value;
		if (index == 0) {
			alert("Select a routepoint row to use");
			onDialogue(shareOneofSeveralRoutepoints, savedData.dialogue);
			return;
			}
		index--;	// from row number to index
		loc = locations[savedData.locationIndex];
		point = allpoints[savedData.indexes[index]];
		print("Will share routepoint '", point.markName, "'\n");
		for (m = 0; m < loc.marks.length; m++){
			mark = loc.marks[m];
			for (u = 0; u < mark.uses.length; u++){
				route = routes[mark.uses[u].route];
				leg = mark.uses[u].leg;
				if (point.GUID != route.waypoints[leg].GUID){
					route.waypoints[leg] = point;
					route.action = update;
					changes ++;
					print("replacing mark '"+ mark.markName + "' in leg ", padString(leg,3), " of '",route.name, "'\n");
					}
				}
			}
		}
	locations.splice(savedData.locationIndex, 1); // finished with this location
	whatToDoB(button);	// next please
	}


function saveDialogue(){
	if (changes < 1) stopScript("No changes made");
	dialogue = [
		caption,
		{type:"text", value:
			"You can now save the changes back into OpenCPN\n"+
			"You are advised to back up the existing waypoints and routes\n" +
			"by making copies of the navobj.xml files"},
		{type: "tick", value:"I understand"},
		{type: "button", label:[buttonQuit, buttonSave]}
		];
	alert();
	onDialogue(doSave, dialogue);
	}

function doSave(dialogue){
	alert(false);
	changes = 0;
	button = dialogue[dialogue.length-1].label;
	if (button == buttonQuit) stopScript("No changes saved");
	else if (!dialogue[2].value){	
		alert("You must tick the box");
		save();
		return;
		}
	else {
		doneSave = false;
		for (i = 0; i < allpoints.length; i++){
			waypoint = allpoints[i];
			if (waypoint.action == remove){
				if (doSaves) OCPNdeleteSingleWaypoint(waypoint.GUID);
				print("Deleted waypoint '", waypoint.markName, "'\n");
				changes++;
				}
			else if (waypoint.action == update){
				if (doSaves) OCPNupdateSingleWaypoint(waypoint);
				print("Updated waypoint '", waypoint.markName, "'\n");
				changes++;
				}
			}
		for (i = 0; i < routes.length; i++){
			route = routes[i];
			if (route.action == remove){
				if (doSaves) OCPNdeleteRoute(route.GUID);
				print("Deleted route '", route.name, "'\n");
				changes++;
				}
			else if (route.action == update){
				if (doSaves) OCPNupdateRoute(route);
				print("Updated route '", route.name, "'\n");
				changes++;;
				}
			}
	if (!changes) throw("Nothing saved\n");
	stopScript(changes + s(" change", changes) + " made in OpenCPN");
		}
	}

function s(text, n){	// post-fix an s if n != 1
	if (n != 1) return(text + "s");
	return text
	}

function getRouteName(rt){	// returns the name for a route
	if (rt.name.length == 0) return("(unnamed)");
	return rt.name;
	}

function formattedPosition(pos){ // returns  position as formatted string
	position = new Position(pos);
	return position.formatted;
	}

function padString(string, len){	// pads a string with spaces out to len
	result = string.toString().trim() + "                                                               ";
	result = result.slice(0, len);
	return result;
	}

function getMarkName(mark){	// given mark as used in script, return mark name
	if (mark.isFreeStanding){
		name = waypoints[mark.index].markName;
		}
	else name = routes[mark.uses[0].route].waypoints[mark.uses[0].leg].markName;
	return(name);
	}

function displayRoute(rt){
	print("Route: '", getRouteName(rt), "'\n");
	for (x = 0; x < rt.waypoints.length; x++){
		print(x,"\t", rt.waypoints[x].isFreeStanding, "\t", rt.waypoints[x].routeCount, "\t", rt.waypoints[x].markName, "\n");
		}
	}

function formatLocation(loc){	// return string displaying location details
	var s = "";
	padding = 0;
	for (p = 0; p < loc.marks.length; p++){ // work out padding needed for this loc
		padding = Math.max(padding, loc.marks[p].markName.length);
		}
	padding += 1;
	for (p = 0; p < loc.marks.length; p++){
		mark = loc.marks[p];
		number = (" " + (p+1)).slice(-2);
		s += number + (mark.isFreeStanding?" WP ":" RP ") + padString(mark.markName, padding) + " ";
		s += mark.GUID.slice(0,5) + ".." + mark.GUID.slice(-5) + " ";
		if (mark.uses.length > 0){	// in at least one route
			thisUse = mark.uses[0];
			s += " leg " + padString(thisUse.leg.toString(), 2) +  " in " +routes[thisUse.route].name + "\n";
			}
		else s+= " (not used in any route)\n";
		for (m = 1; m < mark.uses.length; m++){
			thisUse = mark.uses[m];
			s += padString(" ", 31) + "shared with leg " + padString(thisUse.leg.toString(), 2) + " in " + routes[thisUse.route].name + "\n";
			}
		}
	return (s);
	}
