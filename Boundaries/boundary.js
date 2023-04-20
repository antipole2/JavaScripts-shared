timePerPoint = 50;	// time allowance in ms
trace = false;
boundaries = [];
boundaryNames = [];
waypointGuidsTodo = [];	// to be array of selected waypoints
routeGuidsTodo = [];	// to be array of selected routes
trackGuidsTodo = [];	// to be array of selected routes
inRoutes = 0;	// number of selected waypoints used in a route

onExit(cleanup);
guids = OCPNgetRouteGUIDs();
if (guids.length < 1) throw("No waypoints or routepoints to consider")
for (i = 0; i < guids.length; i++){
	route = OCPNgetRoute(guids[i]);
//	if (route.name.match(/boundary/i) != null){	// case insensitive search for "boundary"\n");
	if (isBoundary(route)){
		boundaries.push(route);
		boundaryNames.push(route.name);
		}
	}

// construct the dialogue, noting where things are
dl = [
	{type:"caption", value:"Waypoint & Route Selector"},
	]
boundaryIndex = dl.length;
dl.push({type:"radio", label:"Select boundary to use", value:boundaryNames});
inOutIndex = dl.length;
dl.push({type:"radio", label:"Inside or outside boundary", value:["Inside", "Outside"]});
crossIndex = dl.length;
dl.push({type:"tick", value:["Include crossing boundary"]});
lookForIndex = dl.length;
dl.push({type:"tickList", label:"What to look for", value:["Waypoints", "Routes", "Tracks"]});
whatToDoIndex = dl.length;
dl.push({type:"tickList", label:"What to do with them", value:["List", "Make visible", "Prefix name"]});
prefixIndex = dl.length;
dl.push({type:"field", label:"Prefix to use", suffix:": rest of name"});
deleteIndex = dl.length;
dl.push({type:"tick", value:["Delete selected objects"]});
dl.push({type:"button", label:["Cancel", "*Go!"]});

onDialogue(action, dl);

function action(response){
	switch (response[response.length-1].label){
		case "Waypoints":	showWP = true; showRT = false; break;
		case "Routes":		showWP = false; showRT = true; break;
		case "Both":		showWP = true; showRT = true; break;
		case "Cancel":		stopScript("Script was cancelled");
		}
	boundaryName = response[boundaryIndex].value;
	foundIt = false;
	for (i = 0; i <= boundaryNames.length; i++){
		if (boundaryName == boundaryNames[i]){
			boundary = boundaries[i];
			foundIt = true;
			break;
			}
		}
	if (!foundIt) throw("Program error - failed to find boundary");
	boundaryPositions = boundary.waypoints;
	inside = (response[inOutIndex].value == "Inside");	// if true, looking inside boundary
	crossing = response[crossIndex].value;
	ticked = response[lookForIndex].value;
	doWp = (ticked.indexOf("Waypoints") >= 0) ? true : false;
	doRt = (ticked.indexOf("Routes") >= 0) ? true : false;
	doTk = (ticked.indexOf("Tracks") >= 0) ? true : false;
	if (trace) printBlue("Looking for\t", doWp, "\t", doRt, "\t", doTk, "\n");
	if (!(doWp || doRt || doTk)) throw("Nothing chosen to look for");

	ticked = response[whatToDoIndex].value;
	list = (ticked.indexOf("List") >= 0) ? true : false;
	makeVisible = (ticked.indexOf("Make visible") >= 0) ? true : false;
	prefix = (ticked.indexOf("Prefix name") >= 0) ? true : false;
	deleting = response[deleteIndex].value;
	if (deleting && (makeVisible || prefix)) throw("Making visible or prefixing and deleting does not make sense");
	if (!(list || makeVisible || prefix || deleting)) throw("No action chosen");
	if (prefix){
		prefixString = response[prefixIndex].value.trim();
		if (trace) printBlue("Prefix is '", prefixString, "'\n");
//		if (prefixString == "") throw("No prefix");
		}

	if (trace) printBlue("What to do\t", list, "\t", makeVisible, "\t", prefix, "\n");

	if (trace) printBlue("Crossing is ", crossing, "\n");
	waypointGuids = OCPNgetWaypointGUIDs();
	if (waypointGuids.length > 500) messageBox("You have " + waypointGuids.length +
			" waypoints.\nThis could take a long time.\nDo not proceed whilst navigating!");
	if (doWp){
		if (trace) printBlue("Waypoints to do: ", waypointGuids.length, "\n");
		oldTime = timeAlloc(timePerPoint*guids.length);
		showing = 0;
		for (p = 0; p < waypointGuids.length; p++){
			wp = OCPNgetSingleWaypoint(waypointGuids[p]);
			if (!wp.isFreeStanding) continue;	// no interest in this
			if (isPointInPolygon(wp.position, boundaryPositions)){
	//			if (trace) printBlue("WP ", wp.markName, " is inside\n");
				selected = inside;
				}
			else selected = !inside;
			if (selected){
				waypointGuidsTodo.push(wp.GUID);
				showing++;
				}
			if (selected && (wp.routeCount > 0))inRoutes++;
			if (list && selected){
				print("Waypoint\t", wp.markName, "\n");
				}
			if (makeVisible){
				if (wp.isVisible != selected){	// change this one
					wp.isVisible = selected;
					OCPNupdateSingleWaypoint(wp);
					if (trace) printBlue("Changing visibility of WP ", wp.markName, " to ", selected, "\n");
					}
				}
			if (prefix){
				revisedName = wp.markName;
				if (selected){
					if (prefixString == "") revisedName = stripPrefix(revisedName);
					else	revisedName = prefixString + ": " + stripPrefix(wp.markName);
					}
				else{
					revisedName = wp.markName;
					if (getPrefix(revisedName) == prefixString){
						// mark outside selction has this prefix
						revisedName = stripPrefix(revisedName);
						}
					}
				if (revisedName != wp.markName){
					wp.markName = revisedName;
					OCPNupdateSingleWaypoint(wp);
					}
				}
			}
		timeAlloc(oldTime);
		print(showing, plural(" waypoint", showing), " selected\n");
		if (inRoutes > 0) printOrange("Warning: ", inRoutes, " selected", plural(" waypoint", inRoutes), " used by one or more routes\nDeleting would corrupt the routes. Remove routes first.\n");
		}
	
	if (doRt){
		// now for routes
		oldTime = timeAlloc(timePerPoint*guids.length);
		routeGuids = OCPNgetRouteGUIDs();
		if (routeGuids.length < 1) throw("No routes to consider");
		showing = 0;
		config = OCPNgetPluginConfig();
		canUpdateRt = (config.PluginVersionMajor >= 2) &&  (config.PluginVersionMinor >= 1);
		notified = false;	// whether reported unable to update routes
		for (r = 0; r < routeGuids.length; r++){
			route = OCPNgetRoute(routeGuids[r]);
			if (isBoundary(route)) continue;	// ignore boundaries
			pointIn = false; pointOut = false;
			for (p = 0; p < route.waypoints.length; p++){
				// what about crossing boundary?
				if (isPointInPolygon(route.waypoints[p].position, boundaryPositions)){
					pointIn = true;
					}
				else pointOut = true;;
				}
			if (pointIn && pointOut) selected = crossing;
			else selected = (pointIn == inside);
			if (selected){
				routeGuidsTodo.push(route.GUID);
				showing++;
				}
			if (list && selected){
				print("Route\t", route.name, "\n");
				}
			if (selected){
				if (trace) printBlue("Will show RT ", route.name, "\n");
				}
			if (makeVisible){
				if (route.isVisible != selected){	// change this one
					if (canUpdateRt){
						route.isVisible = selected;
						if (trace) printBlue("Changing visibility of RT ", route.name, " to ", selected, "\n");
						OCPNupdateRoute(route);
						}
					else {
						if (!notified){
							print("Your version of OpenCPN and the JavaScript plugin cannot change route visibility\nConsider updating\n");
							notified = true;
							}
						} 
					}
				}
			if (prefix){
				revisedName = route.name;
				if (selected){
					if (prefixString == "") revisedName = stripPrefix(revisedName);
					else	revisedName = prefixString + ": " + stripPrefix(revisedName);
					}
				else{
					revisedName = route.name;
					if (getPrefix(revisedName) == prefixString){
						// route outside selction has this prefix
						revisedName = stripPrefix(revisedName);
						}
					}
				if (revisedName != route.name){
					route.name = revisedName;
					OCPNupdateRoute(route);
					}
				}
			}
		print(showing, plural(" route", showing), " selected\n");
		printOrange("If removing routes, you will probably want to exclude the boundaries\n");
		timeAlloc(oldTime);	
		}

	if (doTk){
		// now for tracks
		oldTime = timeAlloc(timePerPoint*guids.length);
		trackGuids = OCPNgetTrackGUIDs();
		if (trackGuids.length < 1) throw("No tracks to consider");
		showing = 0;
		config = OCPNgetPluginConfig();
		canUpdateTk = false;
		notified = false;	// whether reported unable to update tracks
		for (t = 0; t < trackGuids.length; t++){
			track = OCPNgetTrack(trackGuids[t]);
			if (isBoundary(track)) continue;	// ignore boundaries
			pointIn = false; pointOut = false;
			for (p = 0; p < track.waypoints.length; p++){
				// what about crossing boundary?
				if (isPointInPolygon(track.waypoints[p].position, boundaryPositions)){
					pointIn = true;
					}
				else pointOut = true;;
				}
			if (pointIn && pointOut) selected = crossing;
			else selected = (pointIn == inside);
			if (selected){
				trackGuidsTodo.push(track.GUID);
				showing++;
				}
			if (list && selected){
				print("Track\t", track.name, "\n");
				}
			if (selected){
				if (trace) printBlue("Will show TK ", track.name, "\n");
				}
			if (makeVisible){
				if (track.isVisible != selected){	// change this one
					if (canUpdateTk){
						track.isVisible = selected;
						if (trace) printBlue("Changing visibility of TK ", track.name, " to ", selected, "\n");
						OCPNupdateTrack(track);
						}
					else {
						if (!notified){
							print("We cannot presently change the visibility of tracks\n");
							notified = true;
							}
						} 
					}
				}
			if (prefix){
				revisedName = track.name;
				if (selected){
					if (prefixString == "") revisedName = stripPrefix(revisedName);
					else	revisedName = prefixString + ": " + stripPrefix(revisedName);
					}
				else{
					revisedName = track.name;
					if (getPrefix(revisedName) == prefixString){
						// track outside selection has this prefix
						revisedName = stripPrefix(revisedName);
						}
					}
				if (revisedName != track.name){
					track.name = revisedName;
					OCPNupdateTrack(track);
					}
				}
			}
		print(showing, plural(" track", showing), " selected\n");
		timeAlloc(oldTime);	
		}

	if (deleting){
		if (trace) printBlue("Will delete ", waypointGuidsTodo.length, " waypoints\t", routeGuidsTodo.length, " routes\t", trackGuidsTodo.length, " tracks\n");
		num = trackGuidsTodo.length;
		if (num > 0){
			yes = messageBox("Are you sure you want to delete " + num + " selected " + plural("track", num) + " from OpenCPN?", "YesNo");
			if (yes == 2){
				for (i = 0; i < num; i++) OCPNdeleteTrack(trackGuidsTodo[i]);
				}
			}
		num = routeGuidsTodo.length;
		if (num > 0){
			yes = messageBox("Are you sure you want to delete " + num + " selected " + plural("route", num) + " from OpenCPN?", "YesNo");
			if (yes == 2){
				for (i = 0; i < num; i++) OCPNdeleteRoute(routeGuidsTodo[i]);
				}
			}
		num = waypointGuidsTodo.length;
		if (num > 0){
			yes = messageBox("Are you sure you want to delete " + num + " selected " + plural("waypoint", num) + " from OpenCPN?", "YesNo");
			if (yes == 2){
				routeGuids = OCPNgetRouteGUIDs();
				for (i = 0; i < num; i++){
					waypoint = OCPNgetSingleWaypoint(waypointGuidsTodo[i]);
					rc = waypoint.routeCount;
					if (rc == 0) OCPNdeleteSingleWaypoint(waypoint.GUID);
					else {	// waypoint still used by route(s)
						print("Waypoint '", waypoint.markName, "' in use by ", rc, plural(" route", rc), " and will not be deleted\n");
						for (r = 0; r < routeGuids.length; r++){
							route = OCPNgetRoute(routeGuids[r]);
							for (p = 0; p < route.waypoints.length; p++){
								if (route.waypoints[p].markName == waypoint.markName){
									print("In route '", ((route.name == "")?"(unnamed)":route.name), "'\n");
									break;
									}
								}
							}
						}
					}
				}
			}
		} 

	OCPNrefreshCanvas();
	}

function isBoundary(route){ //checks if a route is a boundary
	if (route.name.match(/boundary/i) == null) return false;
	if (trace)printBlue("Examining boundary: ", route.name, " closed? ",
		(route.waypoints[0].GUID == route.waypoints[route.waypoints.length-1].GUID) , "\n");
	// check route is closed loop
	return (route.waypoints[0].GUID == route.waypoints[route.waypoints.length-1].GUID);
	}

function plural(string, count){
	return (string + (count == 1?"":"s"));
	}

function stripPrefix(input){
	pos = input.indexOf(":");
	if (pos > 0) input = input.slice(pos+1);
	input = input.trim();
	return input;
	}

function getPrefix(input){ // returns prefix without : if any, else null
	pos = input.indexOf(":");
	if (pos < 0) return("");
	return input.slice(0, pos);
	}

function cleanup(){
	OCPNrefreshCanvas();
	}

function isPointInPolygon (position, polygon) {
/**
 * Verify if position is insidem polygon of positions
 * adapted from https://dev.to/boobo94/how-to-verify-if-point-of-coordinates-is-inside-polygon-javascript-10n6
 */
	var inside; // ensure is local scaope
	if (typeof position.latitude !== 'number' || typeof position.longitude !== 'number') {
		throw new TypeError('Invalid position');
		}
	else if (!polygon || !Array.isArray(polygon)) {
		throw new TypeError('Invalid polygon. Array with locations expected');
		}
	else if (polygon.length === 0) {
		throw new TypeError('Invalid polygon. Non-empty Array expected');
		}
	const x = position.latitude; const y = position.longitude;
	inside = false;
	for (i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i].position.latitude; const yi = polygon[i].position.longitude
		const xj = polygon[j].position.latitude; const yj = polygon[j].position.longitude
		const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
		if (intersect) inside = !inside
		}
	return inside;
	};
