// Tack advisor v0.2.1  27 Sep 2021
// Since v0.1 added down-wind tacking and onExit clean-up
// v0.2.1 removes degree character from comments in three places as Windows objects
// v0.3 works with relative wind angle
// v0.3.1 fix to ensure deletion of tack route on termination

// configuration
repeatInterval = 5;	// seconds
// wind angles we will work at
minWindAngle = 10;	// Min wind angle to work with
maxWindAngle = 60;	// Max angle off wind we will work with
maxRunWindAngle = 179;	// Don't work if virtually straight down wind

autoHide = false
displayDialogue = true;
debug = false;
simulate= false;
routeName = "tackRoute";	// name of route to be created

// Enduring variables
var routeGUID = false;
var lastPosString = false;
var windDirection = -1;	// < 0 until wind received
var windSpeed;
var tackString;	// the text summarising tack legs
var here;	// OCPN navigation

routeDisplayDialog = [
		{type:"text", value:"", style:{font:"courier"}},
		{type:"caption", value:"Tack advisor"},
		{type:"button", label:["Stop", "Hide"]}
		];

Position = require("Position");
Waypoint = require("Waypoint");
Route = require("Route");
hereWaypoint = new Waypoint;
hereWaypoint.markName = "From";
targetWaypoint = new Waypoint;
targetWaypoint.markName = "To";
tackWaypoint = new Waypoint;
tackWaypoint.markName = "Tack";
tackRoute = new Route;
tackRoute.name = "Tack route";
tackRoute.waypoints[0] = hereWaypoint;
tackRoute.waypoints[1] = tackWaypoint;
tackRoute.waypoints[2] = targetWaypoint;	

// start listening out for wind data
windRetry = windRetryMax =10;	// times to wait for wind data
OCPNonNMEAsentence(processNMEA);

// check if we need to delete an old route
OCPNonMessageName(handleRL, "OCPN_ROUTELIST_RESPONSE");
OCPNsendMessage("OCPN_ROUTELIST_REQUEST", JSON.stringify({"mode": "Not track"}));

consoleHide();
onExit(cleanUp);	// Make sure we cclean up after ourself

function handleRL(routeListJS){	// receive list of routes in JSON
	var i;
	routeList = JSON.parse(routeListJS);
	if (routeList != null) {
		if (routeList.length > 1){  // (changed from 0 because null entry when no routes)
			if (!routeList[0]) routeList.shift(); // drop first null entry - don't know why it is there ''
			}
		count = routeList.length;		// number of existing routes
		for (i = 0; i < count; i++){
			if (routeList[i].name == routeName){
				routeGUID = routeList[i].GUID;
				break;
				}
			}
		if (!routeGUID) routeGUID = OCPNgetNewGUID();
		tackRoute.GUID =routeGUID;
		tackRoute.name = routeName;
		}
	onSeconds(update, repeatInterval);	// start the update cycle
	}

function processNMEA(input){
	here = OCPNgetNavigation();

	if (simulate) here.COG = here.HDM = 45;
	if (input.OK){
		sentence = input.value;
		if (sentence.slice(3,6) == "MWV"){
			if (simulate){
//				sentence = "$WIMWV,45,R,4.96,N,A";
				print(sentence, "\n");
				}
			splut = sentence.split(",");			
			if (splut[5] == "A"){ // valid data
				windDirection = splut[1]; windSpeed = splut[3];
				type = splut[2];
				if (type == "R"){
					windDirection = bearing(here.HDM, windDirection);					
					}
				if (simulate) {
					print("Simulating COG: ", here.COG, " Wind direction: ", windDirection, "\n");
					}
				}
			}
		}
	OCPNonNMEAsentence(processNMEA);	// listen for next sentence
	return;
	}

function update(){
	// real work is done in updateWorks which returns true if advisor active, else false
	// this simplifies breaking out of an update while still scheduling the next one
	active = updateWorks();
	onDialogue(false);	// clear any existing dialogue
	if (displayDialogue){
		if (active) {
			routeDisplayDialog[0].value = tackString;
			onDialogue(dismissDisplay, routeDisplayDialog);
			}
		else if (!autoHide){
			routeDisplayDialog[0].value = "On standby";
			onDialogue(dismissDisplay, routeDisplayDialog);
			}
		}
	onSeconds(update, repeatInterval);
	if (!active){
		try { OCPNdeleteRoute(tackRoute.GUID);}
		catch(err){} 
		}
	}

function updateWorks(){
	// returns true if showing tack, else false
	if (windDirection < 0){	// cannot start yet
		if (windRetry-- > 0) return false;
		alert(false);
		alert("Not found valid wind data");
		windRetry = windRetryMax;
		return false;
		}
	else alert(false);
	APRgpx = OCPNgetARPgpx();  // get Active Route Point as GPX
	if (APRgpx.length == 0) return false;	// no active waypoint
	// we have an Active Route Waypoint - extract its name
	// print(APRgpx, "\n");
	posString = /<wpt lat=\".*\"/.exec(APRgpx);
	if (posString != lastPosString){ // position of target is new
		lat = 1 * posString[0].slice(10,22); // force to number
		lon = 1 * posString[0].slice(29,-3);
		targetWaypoint.position.latitude = lat;
		targetWaypoint.position.longitude = lon;
		lastPosString = posString;
		}
//	here = OCPNgetNavigation();
	var angleToWind;	// angle of wind from course made good
	// NB if windAngle is positive, wind is on starboard side
	windAngle = angle(here.COG, windDirection); // angle off wind
	absWindAngle = Math.abs(windAngle);
	if (absWindAngle < minWindAngle){
		if (debug) print("Head to wind\n");
		return false;
		}
	if (absWindAngle > 90){
		// we are running
		running = true;
		windDirection = angle(180, windDirection);	// use reciprocal windDrection if running
		windAngle = angle(here.COG, windDirection); // angle off wind
		absWindAngle = Math.abs(windAngle);
		if (debug) print("Running\twindDirection:", windDirection, "\t windAngle:", windAngle, "\n");
		if (absWindAngle <= 1) return; // don't bother if dead run
		if (absWindAngle > maxRunWindAngle) {
			if (debug) print("Dead run\n");
			return false;
			}
		}
	else {	// on the wind
		running = false;
		if (absWindAngle > maxWindAngle){
			if (debug) print("Reaching\n");
			return false;	// too close to wind
			}
		}
	var vectorToWpt;	// vector from here to target waypoint
	var oppositeTack;	// bearing if we tack
	var alpha;		// angle between course to waypoint and CMG (+ve clockwise)
	var beta;			//inside angle of tack (180 - change of course)
	var gamma;		// inside angle at target waypoint between direct course and arriving from tack point
	var a, b, c;		// length of passages opposite altha, bete & gamma respectively
	// trigonometry:			a/sin(alpha) = b/sin(beta) = c/sin(gamma)
	hereWaypoint.position = here.position;
	vectorToWpt = OCPNgetVectorPP(hereWaypoint.position, targetWaypoint.position);
	alpha = angle(vectorToWpt.bearing, here.COG);	// is angle between bearing to WP and our COG
	if (Math.abs(alpha) > 90){
		// making away from mark
		if (debug) print("Making away from mark\n");
		return false;
		}
	oppositeTack = bearing(here.COG, 2 * windAngle);
	angleOppositeTackToWpt = angle(vectorToWpt.bearing, oppositeTack);
	// angleOppositeTackToWpt is angle between bearing to WP and our COG if we had tacked
	// if this has same sign as alpha, tacking is not relevant/needed
	if (Math.sign(angleOppositeTackToWpt) == Math.sign(alpha)){
		if (debug) print("Tacking not relevant\n");
		return false;
		}
	if (debug) print("Tacking relevant\n");
	if (running){ // running - things work differently
		alpha = -alpha;
		angleOppositeTackToWpt = -angleOppositeTackToWpt;
		if (debug) print("Wind angle:", windAngle, "\tRunning - opposite tack is:", oppositeTack, "\n");
		}
	else if (debug) print("vectorToWpt.bearing:", vectorToWpt.bearing, "\talpha:", alpha, "\toppositeTack:", oppositeTack, "\n");
	// now for the trigonometry
	beta = angle(here.COG, oppositeTack);
	if (running) {
		beta = angle(180, beta);
		if (Math.abs(beta) < 2){
			if (debug) print("Dead run\n");
			return false;
			}
		}
	b =  vectorToWpt.distance;
	alpha = Math.abs(alpha); beta = Math.abs(beta);
	if (debug) print("angleOppositeTackToWpt:", angleOppositeTackToWpt, "\tbeta:", beta, "\tb:", b, "\talpha:", alpha, "\n");
	// when at tack point...
	a = b*Math.sin(alpha*Math.PI/180)/Math.sin(beta*Math.PI/180);	// distance from tack point to waypoint
	gamma = Math.abs(180 - alpha - beta);	// angle between bearing to waypoint and bearing from tackpoint to waypoint
	bearingTpToWp = bearing(windDirection, windAngle);
	if (running) bearingBackToTp = bearing(180, bearingTpToWp);// reciprocal
	else bearingBackToTp = bearing(bearingTpToWp, 180);// reciprocal
	vectorBackToTp = {distance: a, bearing: bearingBackToTp};
	if (debug) print("gamma:", gamma, "\tbearingTpToWp:", bearingTpToWp, "\tbearingBackToTp:", bearingBackToTp,
		"\nvectorBackToTp:", vectorBackToTp, "\n")
	tackPosition = OCPNgetPositionPV(targetWaypoint.position, vectorBackToTp);
	tackWaypoint.position.latitude = tackPosition.latitude;
	tackWaypoint.position.longitude = tackPosition.longitude;

// now to create/update the route - not sure if we have one already or are updating
	try { OCPNupdateRoute(tackRoute); }
	catch (err) {
		routeGUID = OCPNaddRoute(tackRoute);
		tackRoute.GUID = routeGUID;
		}

// 	now to display the outcome
	if (displayDialogue){
		vectorToTp = OCPNgetVectorPP(here.position, tackPosition);
		c = vectorToTp.distance;
		SOG = (here.SOG)*1;
		onDialogue(false);	// clear any existing
		tackString =	"Leg 1: " + ("  " + c.toFixed(1)).slice(-4) + "nm  " + ("  " +(c/SOG*60).toFixed(1)).slice(-4) + "mins\n" +
					"Leg 2: " + ("  " + a.toFixed(1)).slice(-4) + "nm  " + ("  " +(a/SOG*60).toFixed(1)).slice(-4) + "mins\n" +
					"Total: " + ("  " + (c+a).toFixed(1)).slice(-4) + "nm  " + ("  " +((c+a)/SOG*60).toFixed(1)).slice(-4) + "mins\n";
		}
	return true;
	}

function angle(bearing1, bearing2){
	// returns  angle between two bearings
	// result is +ve if bearing2 up to 180 clockwise of bearing1
	// result is -ve if bearing2 up to 179.99 anticlockwise of bearing1
	bearing2 = bearing2*1 + 360;	// ensure next result is +ve
	diff = (bearing2 - bearing1)%360;
	if (diff > 180) diff -= 360;
	return diff;
	}


function bearing(bearing, angle){
	// given a bearing, returns the bearing changed by angle	
	newBearing = 1*bearing + 1*angle;
	if (newBearing < 0) newBearing += 360;
	newBearing = newBearing % 360
	return newBearing;
	}

function dismissDisplay(dialogue){
	if (dialogue[dialogue.length-1].label == "Stop") {
		try { OCPNdeleteRoute(tackRoute.GUID);}
		catch(err){}
		stopScript("Script was stopped");
		}
	else displayDialogue = false;
	}

function updateSimulator(dialogue){
	button = dialogue[dialogue.length-1].label;
	if (button == "Stop") {
		try { OCPNdeleteRoute(tackRoute.GUID);}
		catch(err){}
		stopScript("Script was stopped");
		}
	simWind = dialogue[3].value;
	simCMG = dialogue[4].value;
	simSOG = dialogue[5].value;
	update();
	}

function cleanUp(){	// cleanup any left-over route
	try { OCPNdeleteRoute(tackRoute.GUID);}
	catch(err){} 
	}
