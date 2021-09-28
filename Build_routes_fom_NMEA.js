// constructs route from NMEA WPL & RTE sentences
// optional simulator to synthesis NMEA data

// Updated v0.2.1 2 Sep 2020 to fix bugs when no routes and be consistent with NMEA message as object
// Updated v0.2.2 7 Sep 2020 several changes to correct when waypoints updated and to include Danish similation data
// Updated v0.2.3 9 Sep 2020 to fix when loading existing routes and there are none

// options
replaceExitingRoutes = true;	// if true, any exiting OpenCPN route with the same name will be updated
testMode = true;	// if true, uses simulated data rather than listening for real NMEA sentences
// There is an option within the simulator to use either data supplied by the Technical University of Denmark or synthesised data in the English Channel.
icon = "Diamond";	// icon name for waypoints

Position = require("Position");	  // load constructors
Waypoint = require("Waypoint");
Route = require("Route");

routes = [];	// will be our array of routes
waypoints = [];		// array of waypoints
waitingOnRoutes = true;	// will set false once we have existing OPCN routes, if required

if (replaceExitingRoutes) {
	// need to load existing routes into routes array
	OCPNonMessageName(handleRL, "OCPN_ROUTELIST_RESPONSE");
	OCPNsendMessage("OCPN_ROUTELIST_REQUEST", JSON.stringify({"mode": "Not track"}));
	// processing will be started from handleRL
	}
else if (!testMode) OCPNonNMEAsentence(processNMEA);	// start collecting sentences
else {	// simulating without replacing existing routes
	waitingOnRoutes = false;
	simulate();
	}
OCPNrefreshCanvas();
"Done"

function handleRL(routeListJS){	// receive list of routes in JSON
	var i;
	routeList = JSON.parse(routeListJS);
	if (routeList != null) {
		if (routeList.length > 1){  // (changed from 0 because null entry when no routes)
			if (!routeList[0]) routeList.shift(); // drop first null entry - don't know why it is there ''
			}
		count = routeList.length;		// number of existing routes
		}
	else count = 0;
	if (count > 0){
		if (count > 1){ // check route names unique
			routeList.sort(function(a,b){ // sort on route name
				return ((a.name < b.name) ? -1 : 1);
				});
			for (i = 0; i < count - 1; i++){
				if (routeList[i].name == routeList[i+1].name)
					throw("Existing route names in OpenCPN not unique");
				}
			}
		for (i = 0; i < count; i++){
			// add each route to the array of routes
			route = new Route;
			if (!route.get(routeList[i].GUID)) throw("Failed to get route from OPCN");
			route.n = 0; route.m = 0; // add extra attributes for later use 
			routes.push(route);	// add onto the array
			}
		print(routes.length, " existing routes loaded\n");
		waitingOnRoutes = false;	// we now have an array of all OPCN routes

		}
	if (testMode) simulate();
	else OCPNonNMEAsentence(processNMEA);	// start ccollecting ssntences
	}

function processNMEA(message){
	if (message.OK){
		sentence = message.value;
			switch (sentence.slice(3,6)) {
			case "WPL": processWPL(sentence);
				break;
			case "RTE": processRTE(sentence);
			default: break;
			}
		}
	if (!testMode) OCPNonNMEAsentence(processNMEA);
	}

function processWPL(sentence){ // maintain array of waypoints received
	var i;
	splut = sentence.split(",");
	name = splut[5];
	// Have we seen this one before?
	if (waypoints.length > 0){
		for (i = 0; i < waypoints.length; i++){
			if (waypoints[i].markName == name){ // yes- we are updating waypoint
				waypoints[i].position.NMEAdecode(sentence,1);	// update position in case it has moved
				return;
				}
			}
		}
	// this is a new one
	waypoint = new Waypoint;
	waypoint.markName = name;
	waypoint.iconName = icon;
	waypoint.position.NMEAdecode(sentence, 1);
	waypoints.push(waypoint);	// add to our array
	}
				

function processRTE(sentence){
	var i;

	function addToRoute(routeToUse, splut){ // add the waypoint in splut to route
		var j, k;
		for (j = 5; j < splut.length; j++){	// work through waypoints in this installment
			waypointName = splut[j];
			found= false;
			for (k = 0; k < waypoints.length; k++){
				if (waypoints[k].markName == waypointName){
					routeToUse.waypoints.push(waypoints[k]);	// add this waypoint to route
					found = true;
					break;
					}
				}
			if (!found) throw("Route " + routeName + " has unknown waypoint " + waypointName);
			}
		}

	// NB there is a major complication in that RTE sentences come in installments n of m
	// so we cannot actually display route until all m parts ave ben received in sequence
	splut = sentence.split(",");
	routeName = splut[4];
	for (i = 0; i < routes.length; i++){	// check for existing route or part thereof
		if (routes[i].name == routeName){
			m = splut[1]; n = splut[2];	// part n of m
			if (n == 1) {
				routes[i].purgeWaypoints();	// if part 1, clear out any old waypoints
				routes[i].n = 0;	// set last to zero so this 1 more
				}
			A = n*1; B = (routes[i].n)*1;	// before numerical compare, force to be numbers
			if (A != (B + 1)) {
				print(sentence, " out of sequence - ignored\n");
				return;
				}
			routes[i].n = n; routes[i].m = m;	// remember where we have got to in parts
			addToRoute(routes[i], splut);
			if (n == m) { 	// got last part - update in OPCN
				if (!routes[i].update()){	// try updating
					//failed to update - must be new one
					GUID = routes[i].add();
					if (!GUID) throw("Failed to add route " + routeName + "\n");
					routes[i].GUID = GUID;
					}
				}
			return;
			}
		}
	// here because not seen this route before
	route = new Route;
	route.name = routeName;
	m = splut[1]; n = splut[2];
	if (n != 1) {
		//if new route but this not 1st part ignore it and wait for next transmission
		delete route;
		return;	
		}
	addToRoute(route, splut);
	route.n = n; route.m = m;
	if (n = m) {
		// we have complete route
		GUID = route.add();	// add to OPCN
		if (!GUID) throw("Failed to add route " + routeName + "\n");
		route.GUID = GUID;
		}
	routes.push(route);	// add it to our array of routes
	}
	
function simulate(){
	// generate simulated data
	useDanishData = true;
	var n, i;
	var numberOfWaypoints = 10;
	var scale = 0.05;
	var message = {OK:"OK", value:""};

	if (useDanishData){
		danishData = ["$GPWPL,5455.608,N,1019.308,E,wpt1*34",
		"$GPWPL,5501.608,N,1025.308,E,wpt2*38",
		"$GPWPL,5507.608,N,1031.308,E,wpt3*3a",
		"$GPWPL,5513.608,N,1037.308,E,wpt4*3e",
		"$GPWPL,5519.608,N,1043.308,E,wpt5*36",
		"$GPWPL,5525.608,N,1049.308,E,wpt6*30",
		"$GPWPL,5531.608,N,1055.308,E,wpt7*39",
		"$GPWPL,5537.608,N,1101.308,E,wpt8*30",
		"$GPWPL,5543.608,N,1107.308,E,wpt9*34",
		"$GPWPL,5549.608,N,1113.308,E,wpt10*03",
		"$GPRTE,2,1,c,TestRoute,wpt1,wpt2,wpt3,wpt4,wpt5*35",
		"$GPRTE,2,2,c,TestRoute,wpt6,wpt7,wpt8,wpt9,wpt10*06",
		"$GPWPL,5501.608,N,1019.308,E,wpt1*34",
		"$GPWPL,5507.608,N,1025.308,E,wpt2*3e",
		"$GPWPL,5513.608,N,1031.308,E,wpt3*3f",
		"$GPWPL,5519.608,N,1037.308,E,wpt4*34",
		"$GPWPL,5525.608,N,1043.308,E,wpt5*39",
		"$GPWPL,5531.608,N,1049.308,E,wpt6*35",
		"$GPWPL,5537.608,N,1055.308,E,wpt7*3f",
		"$GPWPL,5543.608,N,1101.308,E,wpt8*33",
		"$GPWPL,5549.608,N,1107.308,E,wpt9*3e",
		"$GPWPL,5555.608,N,1113.308,E,wpt10*0e",
		"$GPRTE,2,1,c,TestRoute,wpt1,wpt2,wpt3,wpt4,wpt5*35",
		"$GPRTE,2,2,c,TestRoute,wpt6,wpt7,wpt8,wpt9,wpt10*06"];
		while (danishData.length > 0){
			message.value = danishData.shift();
			message.value = message.value.slice(0, -3);
			processNMEA(message);
			}
		print("Simulator used Danish data\n");
		}
	else {
		nextPosition = new Position(50.3, -1);	// SE of Isle of Wight
		print("Simulating with route starting at ", nextPosition.formatted, "\n");
		var routeName = "JSroute";
		var waypointNames = [];
		var batch = [];	// to hold batch of RTE sentence and waypoint names;
		var i;
		// generate waypoints
		for (i = 1; i <= numberOfWaypoints; i++){
			wpName = "Waypt" + i;
			waypointNames.push(wpName);
			nextPosition.latitude += Math.sin(i)*scale;
			nextPosition.longitude = nextPosition.longitude + 0.05;
			sentence = "$GPWPL," + nextPosition.NMEA + "," + wpName;
			message.value = sentence;
			processNMEA(message);
			}

		// now some routes
		maxM = 5;	// Maximum number of waypoints in each sentence
		toDo = waypointNames.length;
		maxM = Math.min(maxM, toDo);	// maximum not to exceed actual number
		m = Math.ceil(toDo/maxM); // installments
		n = 1; // next installment
		while (waypointNames.length > 0){	// using n of m notation
			i = Math.min(maxM, waypointNames.length);
			batch.length = 0;	// clear array
			while (i--){
				batch.push(waypointNames.shift());
				}
			if (batch.length > 0){	// have a batch to send
				sentence = "$GPRTE," + m + "," + n + ",c," + routeName + "," + batch.join(",");
				message.value = sentence;
				processNMEA(message);
				n++;
				}
			}
		}
	print("Simulator finished\n");
	}