routeGUID = "48cf3bc5-3abb-4f73-8ad2-994e796289eb";
OCPNonMessageName(handleRT, "OCPN_ROUTE_RESPONSE");
OCPNsendMessage("OCPN_ROUTE_REQUEST",JSON.stringify({"GUID":routeGUID}));

function handleRT(routeJS){
	route = JSON.parse(routeJS);
	try {print("RouteGUID ", routeGUID, " has the name ",
		route.name, "\n");}
	catch(err){print("No such route\n");}
	};