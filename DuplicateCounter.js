var suffixSeparator = ".";
var routes = [];	// To be array of routes
var routeNames = [];
var waypointNames = [];
var routepointGUIDs = [];
var waypointGUIDs = [];
var waypoints = [];

OCPNonMessageName(handleRL, "OCPN_ROUTELIST_RESPONSE");
OCPNsendMessage("OCPN_ROUTELIST_REQUEST", JSON.stringify({"mode": "Not track"}));

function handleRL(routeListJS){
	routeList = JSON.parse(routeListJS);
	if (routeList != null) {
		if (routeList.length > 1){  // (changed from 0 because null entry when no routes)
			if (!routeList[0]) routeList.shift(); // drop first null entry - don't know why it is there
			}
		}
	print(routeList.length, " routes found\n");
	for (r = 0; r < routeList.length; r++)
		{
		routeNames.push(routeList[r].name);
		}
	routeNames.sort();
	duplicates = false
	for (r = 0; r < routeNames.length; r+=copies){
		start = r; end = start + 1;
		while (routeNames[start] == routeNames[end]){
			end++;}
		copies = end - start;
		if (copies ==2) print("Route ", routeNames[r], " used twice\n");
		else if (copies > 2) print("Route ", routeNames[r], " used ", copies, " times\n");
		if (copies > 1) duplicates++;
		}
	if (!duplicates) print("All route names unique\n");

	wpGUIDs = OCPNgetWaypointGUIDs();
	print(wpGUIDs.length," waypoints found\n");
	for (w = 0; w < wpGUIDs.length; w++)
		{
		waypoint = OCPNgetSingleWaypoint(wpGUIDs[w])
		waypointNames.push(waypoint.markName);
		}
	waypointNames.sort();

	duplicates = false
	for (w = 0; w < waypointNames.length; w+=copies){
		start = w; end = start + 1;
		while (waypointNames[start] == waypointNames[end]){
			end++;}
		copies = end - start;
		if (copies ==2) print("Waypoint name ", waypointNames[w], " used twice\n");
		else if (copies > 2) print("Waypoint name ", waypointNames[w], " used ", copies, " times\n");
		if (copies > 1) duplicates++;
if (copies = 1) print("Point ", waypointNames[w], " used once\n");
		}
	if (!duplicates) print("All waypoints have unique names\n");
	
	}