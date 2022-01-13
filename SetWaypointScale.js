// set show at scale for waypoints selected by icon

guids = OCPNgetWaypointGUIDs();
for (w = 0; w < guids.length; w++){
	waypoint = OCPNgetSingleWaypoint(guids[w]);
	if (!waypoint.isFreeStanding) continue;	// ignore routepoints
	if (waypoint.iconName == "cicle") waypoint.useMinScale = false;
	else {
		waypoint.useMinScale = true;
		waypoint.minScale = 52000;
		}
	OCPNupdateSingleWaypoint(waypoint);
	}
