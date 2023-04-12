// This script sends any active route out as WPT and RTE sentences so that iNavX shows the up-to-date active route.
// If the route or its routepoints are updated, iNavX will update to reflect this
// V2.0 - major rewrite to utilise latest plugin capabilities - much simplified
// V2.01 - fixed error crept in to RMB sentence
// V3.0 - major rewrite to take advantage of OpenCPN v5.6 & JavaScript plugin v0.5
// V3.1 - no active waypoint alert displayed only once
// V3.2 - checks for no route name and drops nasty chars in route and mark names

const repeatInterval = 15;		// repeat after this number of seconds

//	here we define enduring variables we need outside the functions
var debug = false;			// for debug prints
var log = false;				// log output
var alerts = true;			// diplay advisory alerts
var noAWPalerted = false;		// Have already displayed no active waypoint alert
const prefix = "$NV";		// NMEA identifier
var activeWaypointGUID = false;
var lastActiveWaypointGUID = false;
var route;
var activeRoutePoint = false;
var lastRoutePoint = false;
var startFrom = false;		// waypoint where we started from if before 1st point in route, else false
var activeWpSentence = false;

config = OCPNgetPluginConfig();
version = config.versionMajor + config.versionMinor/10;
if (version < 0.5) throw("Script requires plugin v0.5 or later");

Position = require("Position");	// load the required constructors
Waypoint = require("Waypoint");
Route = require("Route");	

var workingPosition = new Position();


if (alerts) alert("SendActiveRoute active\n");
OCPNonNMEAsentence(processNMEA);  	// start processing NMEA sentences			
listenOut();	// start listening
if (!debug) {
	if (version >= 2) consolePark();
	else consoleHide();
	}

function listenOut(){
	if (debug) print("Listening out\n");
	// this is where we start the action
	activeRouteGUID = OCPNgetActiveRouteGUID();
	if (activeRouteGUID){
		activeWaypointGUID = OCPNgetActiveWaypointGUID();
		if (!activeWaypointGUID) throw("Logic error - no activeWaypointGUID");
		activeWaypoint = OCPNgetSingleWaypoint(activeWaypointGUID);
		route = OCPNgetRoute(activeRouteGUID);
		route.name = clean(route.name);
		if (route.name.length == 0){	// empty route name
			alert(false);
			alert("Route has empty name");
			onSeconds(listenOut, repeatInterval);	 // listen out for something better
			return;
			}
		if (activeWaypointGUID != lastActiveWaypointGUID){ // active waypoint has changed
			if (alerts){
				alert(false);
				alert("Active routepoint now ", activeWaypoint.markName, "\n");
				noAWPalerted = false;
				}
			lastRoutePoint = activeRoutePoint;	// remember what it was
			}
		if (route.waypoints[0].GUID == activeWaypointGUID){
			// we are yet to reach the first point of the route
			// so we need to insert a starting point on the front of the route
			if (!lastActiveWaypointGUID){
				// we have not yet established our starting point
				here = OCPNgetNavigation();
				startFrom = new Waypoint(here)
				startFrom.markName = "Start";
				lastRoutePoint = startFrom;
				}	
			route.waypoints.unshift(startFrom);	// add starting point to route
			} 
		for (p = 0; p < route.waypoints.length; p++){	// for each point in route
			point = route.waypoints[p];
			point.markName = clean(point.markName);
			workingPosition.latitude = point.position.latitude;
			workingPosition.longitude = point.position.longitude;
			sentence = prefix + "WPL" + "," + workingPosition.NMEA + "," + point.markName;
			send(sentence); // OCPNpushNMEA(sentence);
			if (point.GUID == activeWaypointGUID) { // this is the active point
				activeWpSentence = sentence;
				activeRoutePoint = point;
				if (p > 0) lastRoutePoint = route.waypoints[p-1]; // expect p > 0 always but being carefull
				}
			}
		// next we build an array of lists of routepoints to go in each RTE sentence as space permits
		available = 79 - 15 - route.name.length - 3;  // space available in RTE for routepoint names
		spaceLeft = available;
		var wpLists = []; // create our array of routepoint groups to go in an RTE sentence
		wpLists.length = 0;	// Force empty array - don't know why we need to do this
		listIndex = 0;
		wpLists[listIndex] = "";
		for (p = 0; p < route.waypoints.length; p++){
			nextRoutePoint = route.waypoints[p];				
			wpName = route.waypoints[p].markName;
			wpNameLength = wpName.length;
			if (spaceLeft >= wpNameLength){
				wpLists[listIndex] += (wpName + ",");
				spaceLeft -= (wpNameLength+1);	//allow for comma
				continue;
				}
			else{
				// no more space in this one
				wpLists[listIndex] = wpLists[listIndex].slice(0,-1);  // drop trailing comma
				wpLists.push("");  // new array member starts empty
				listIndex += 1; spaceLeft = available;
				p -= 1; // don't forget this last routepoint still to be fitted in next time
				}
			}
		// we may have a trailing comma after last one
		lastOne = wpLists[listIndex];
		lastChar = lastOne.charAt(lastOne.length - 1);
		if (lastChar == ",") lastOne = lastOne.slice(0,-1); // drop it
		wpLists[listIndex] = lastOne;
		arrayCount = wpLists.length;
		for (i in wpLists) { // send out the RTE sentences
			sentence = prefix + "RTE," + arrayCount + "," + (i*1+1) + ",c," + route.name + "," + wpLists[i];
			send(sentence);
			}
		lastActiveWaypointGUID = activeWaypointGUID; // remember
		}
	else {	// no active route/waypoint
		if (alerts){
			alert(false);
			if (!noAWPalerted){
				noAWPalerted = true;
				alert("No active routepoint\n");
				}
			}
		activeWaypointGUID = false;
		lastActiveWaypointGUID = false;
		startFrom = false;
		}
	if (debug) printBlue("activeRouteGUID: ", activeRouteGUID, "\n");
	onSeconds(listenOut, repeatInterval);	 // Do it again
	}


function send(sentence){
	if (log) printOrange(sentence, "\n");
	OCPNpushNMEA(sentence);
	}

function processNMEA(input){	// we need to un-abbreviate the routepoint name in APB sentences
	if(input.OK && activeRouteGUID){ // only bother if have active route
		switch (input.value.slice(0,6)) {
		case "$ECRMB":
			if (debug) printBlue("Received NMEA: ", input.value, "\n");
			{
			if (nextRoutePoint == "") break;	// we cannot act until we have this
			splut = input.value.split(",", 20);
			shortWPname = splut[4];
			if (activeWaypoint.markName.startsWith(shortWPname)){  // we check this really is the right one
				splut[0] = prefix + "RMB";		// give it our branding
				splut[4] = lastRoutePoint.markName; // and add the origin WP name
				splut[5] = activeRoutePoint.markName;	// the full destination WP Name
				bearingToDest = splut[11];	// remember the bearing
				result = splut.join(",");  // put it back together
				send(result);
				// now add a BOD sentence
				bearingToDest = Number(bearingToDest);  // force this to be number for next bit
				/*  kluge  */  variation = 0;
				bearingToDestM = bearingToDest + variation;
				sentence = prefix + "BOD" + "," + bearingToDest.toFixed(2) + "," + "T" + "," + bearingToDestM.toFixed(2) + "," + "M" + "," + activeRoutePoint.markName + "," + lastRoutePoint.markName;
				if (debug) print(sentence, "\n");
				send(sentence); //OCPNpushNMEA(sentence);
				if (activeWpSentence) send(activeWpSentence);
				}
			break;
			}
		case "$ECAPB":
			{
			if (debug) printBlue("Received NMEA: ", input.value, "\n");
			// print("APB received\n");
			splut = input.value.split(",", 20);
			splut[0] = prefix + "APB";		// give it our branding
			splut[10] = activeRoutePoint.markName;  // the full destination WP Name
			result = splut.join(",");  // put it back together
			send(result);
			break;
			}
		default:
			break;
			}
		}
	OCPNonNMEAsentence(processNMEA); // Listen out for another NMEA sentence
	}

function clean(input) { // purge input string of troublesome characters
	nasties = ",()"; //chars to drop
	output = "";
	for (i = 0; i < input.length; i++){
		ch = input[i];
		found = nasties.indexOf(ch);
		if (found < 0) output += ch;
		}
	return output;
	}