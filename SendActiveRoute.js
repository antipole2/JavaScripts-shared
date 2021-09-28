// This script sends any active route out as WPT and RTE sentences so that iNavX shows the up-to-date active route.
// If the route or its routepoints are updated, iNavX will update to reflect this
// V2.0 - major rewrite to utilise latest plugin capabilities - much simplified

Position = require("Position");	// load the required constructors
Route = require("Route");	

//	here we define enduring variables we need outside the functions
var debug = false;			// for debug prints
var log = false;				// log output
var alerts = true;			// diplay advisory alerts
var longWaypoints = true;		// restore long waypoint names
const prefix = "$NV";		// NMEA identifier
const repeatInterval = 15;		// repeat after this number of seconds
var activeRoutepointName = "";		// to hold the active routepoint name, else ""
var activeRouteName = "";	// the name of the active route
var lastRoutePoint;			// these two are needed to fix up  RMB sentences and synthesise a BOD sentence…
var nextRoutePoint;			// … which is needed so iNavX can work out which leg of the route we are on
var bearingToDest;			// bearing to destination WP from where WP is activated
var fromHere;				// position we are navigating from
var start					// waypoint we start from
var variation;				// magnetic variation
var workingPosition = new Position();	// creates a working position object
var route = new Route();		// a working route object

if (alerts) alert("SendActiveRoute active\n");
if (longWaypoints) OCPNonNMEAsentence(processNMEA);  	// start processing NMEA sentences			
listenOut();
consoleHide();				// start listening

function listenOut(){
	if (debug) print("Listening out\n");
	// this is where we start the action
	APRgpx = OCPNgetARPgpx();  // get Active Route Point as GPX
	if (debug) print(APRgpx, "\n");
	if (APRgpx.length > 0){
		// we have an Active Route Point. Need to extract the routepoint name and save for later
		routepointPart  = /<name>.*<\/name>/.exec(APRgpx);
		routepointName = routepointPart[0].slice(6, -7);
		if (routepointName != activeRoutepointName){
			// active routepoint has changed
			bearingToDest = "";	// invalidate any previous info
			lastRoutePoint = "";  nextRoutePoint = "";
			activeRoutepointName = routepointName;
			if (alerts){
				alert(false);
				alert("Active routepoint now ", routepointName, "\n");
				}
			// we need to remember our position for navigation from here to next routepoint
			here = OCPNgetNavigation();
			delete start; /***/
			start = new Waypoint(here);
			start.markName = "Start";
			variation = here.variation; //save magnetic variation
			// now get the route leg
			OCPNonMessageName(handleAR, "OCPN_ACTIVE_ROUTELEG_RESPONSE");
			OCPNsendMessage("OCPN_ACTIVE_ROUTELEG_REQUEST");
			}
		else { // still on same leg - send same stuff
			formSentences();
			}
		}
	else {
		if (debug) print("No active route routepoint in GPX\n");
		if (activeRoutepointName != ""){
			// No longer have active Routepoint			
			if (alerts){
				alert(false);
				alert("No active routepoint\n");
				}
			}
		activeRoutepointName = "";
		}
	onSeconds(listenOut, repeatInterval);	 // Do it again
	}

function handleAR(activeRouteJS){
	// we have received the active route, if there is one
	// have seen invalid JSON e.g. when no XTE, so..
	try {activeRoute = JSON.parse(activeRouteJS);}
	catch(err){
		return;
		}
	if (debug) print("Active route:\n", activeRoute,"\n");
	// NB the JSON returned creates an array
	if (!activeRoute[0].error ){
		// we have an active route
		routeGUID = activeRoute[0].active_route_GUID;
		delete route;
		route = new Route;
		route.get(routeGUID);
		if (debug) print("Route is: ", route.name, " with ", route.waypoints.length, " routepoints\n");
		activeRouteName = route.name;	// attribute in here has capitalised name!
		lastRoutePoint = ""; nextRoutePoint = "";  // clear out previous route info
		formSentences();
		}
	else throw("Active route point but active route returned had error");	
	}

function formSentences(){
	// we work through the route points, sending out WPL sentences and noting which is the next and last
	if (debug) print("Route: ", route, "\n");
	for (i = 0; i < route.waypoints.length; i++){// push out the WPT sentences
		workingPosition.latitude = route.waypoints[i].position.latitude;	// convert from position as in JSON to our way of doing it
		workingPosition.longitude = route.waypoints[i].position.longitude;
		sentence = prefix + "WPL" + "," + workingPosition.NMEA + "," + route.waypoints[i].markName;
		send(sentence); // OCPNpushNMEA(sentence); 
		if (route.waypoints[i].markName == activeRoutepointName){
			activeWPL = sentence;	// remember for later]
			if (debug) print("Remembering routepoint ", i, ": ", activeWPL, "\n");
			if (i > 0) {
				// not the first routepoint
				lastRoutePoint = route.waypoints[i-1];
				nextRoutePoint = route.waypoints[i];
				}
			else {
				// Still to reach first point - use special start waypoint
				sentence = prefix + "WPL" + "," + start.position.NMEA + "," + start.markName;
				if (debug) print("Start waypoint: ", sentence, "\n"); 
				route.waypoints.unshift(start);	// add it to start of route
				i++;	// adjust position
				send(sentence);	// send this extra start wp
				lastRoutePoint = start;
				nextRoutePoint = route.waypoints[i];
				}
			vectorToWp = OCPNgetVectorPP(lastRoutePoint.position, nextRoutePoint.position);
			bearingToDest = vectorToWp.bearing;
			}
		}	
	// next we build an array of lists of routepoints to go in each RTE sentence as space permits
	available = 79 - 15 - route.name.length - 3;  // space available in RTE for routepoint names
	spaceLeft = available;
	var wpLists = []; // create our array of routepoint groups to go in an RTE sentence
	wpLists.length = 0;	// Force empty array - don't know why we need to do this
	listIndex = 0;
	wpLists[listIndex] = "";
	for (i = 0; i < route.waypoints.length; i++){
		wpName = route.waypoints[i].markName;
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
			i -= 1; // don't forget this last routepoint still to be fitted in next time
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
	// Now to send a BOD sentence
	if (bearingToDest != ""){ 	// can only do this if we have acquired a bearing - else wait until we have it
		bearingToDest = bearingToDest*1;  // force this to be number for next bit
/*  kluge  */  variation = 0;
		bearingToDestM = bearingToDest + variation;
		sentence = prefix + "BOD" + "," + bearingToDest.toFixed(2) + "," + "T" + "," + bearingToDestM.toFixed(2) + "," + "M" + "," + nextRoutePoint.markName + "," + lastRoutePoint.markName;
		if (debug) print(sentence, "\n");
		send(sentence); //OCPNpushNMEA(sentence);
		if (activeWPL != "") send(activeWPL); //OCPNpushNMEA(activeWPL);  // repeat the active WPL fer th BOD, as per MacENC
		}
	else if (alert) alert("Waiting for BOD\n");
	}

function processNMEA(input){	// we need to un-abbreviate the routepoint name in APB sentences
	if(input.OK && (activeRouteName != "")){ // only bother if have active routepoint
		switch (input.value.slice(0,6)) {
		case "$ECRMB":
			{
			if (nextRoutePoint == "") break;	// we cannot act until we have this
			splut = input.value.split(",", 20);
			shortWPname = splut[5];
			if (activeRoutepointName.startsWith(shortWPname)){  // we check this really is the right one
				splut[0] = prefix + "RMB";		// give it our branding
				splut[4] = lastRoutePoint.markName; // and add the origin WP name
				splut[5] = nextRoutePoint.markName;	// the full destination WP Name
				bearingToDest = splut[11];	// remember the bearing
				result = splut.join(",");  // put it back together
				send(result);
				}
			break;
			}
		case "$ECAPB":
			{
			// print("APB received\n");
			splut = input.value.split(",", 20);
			splut[0] = prefix + "APB";		// give it our branding
			splut[10] = nextRoutePoint.markName;  // the full destination WP Name
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

function send(sentence){
	if (log) print(sentence, "\n");
	OCPNpushNMEA(sentence);
	}
