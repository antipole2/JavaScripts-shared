// select waypoints in rectangle between TopLeft and BottomRight

guids = OCPNgetWaypointGUIDs();

// look for rectangle
tlCount = 0; brCount = 0;
for (i = 0; i < guids.length; i++){
	waypoint = OCPNgetSingleWaypoint(guids[i]);
	if (!waypoint.isFreeStanding) continue;	// ignore routepoints
	if (waypoint.markName == "TopLeft"){
		tlCount++;
		top = waypoint.position.latitude;
		left = waypoint.position.longitude;
		show(waypoint, true);	// always show this one
		}
	else if (waypoint.markName == "BottomRight"){
		brCount++;
		bottom = waypoint.position.latitude;
		right = waypoint.position.longitude;
		show(waypoint, true);	// always show this one
		}
	}

// checks
if (tlCount == 0) throw("No TopLeft waypoint");
if (tlCount > 1) throw("More than one TopLeft waypoint");
if (brCount == 0) throw("No BottomRight waypoint");
if (brCount > 1) throw("More than one BottomRight waypoint");
if ((bottom >= top) || (right <= left)) throw("BottomRight not SE of TopRight");

// we have our rectangle
shown = hidden = 0;
for (i = 0; i < guids.length; i++){
	waypoint = OCPNgetSingleWaypoint(guids[i]);
	if (!waypoint.isFreeStanding) continue;	// ignore routepoints
	if ((waypoint.markName == "TopLeft") || (waypoint.markName == "BottomRight"))
		continue;	// ignore the corner markers
	inside =
		(waypoint.position.latitude <= top) && (waypoint.position.latitude <= bottom)  &&
		(waypoint.position.longitude >= left) && (waypoint.position.longitude <= right);
	show(waypoint, inside);
	if (inside) {shown++;}
	else {hidden++;}
	}
scriptResult = shown + " shown & " + hidden + " hidden";

function show(wp, yes){
	if (wp.isVisiible != yes){
		wp.isVisible = yes;
		OCPNupdateSingleWaypoint(wp);
		}
	}