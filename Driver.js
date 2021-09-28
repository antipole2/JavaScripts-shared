// Drive ship in absence of real NMEA inputs

Position = require("Position");
// we construct the panel dynamically, so we can note where things are
panel = [];
panel.push({type:"caption", value:"Simple ship and wind driver"});
panel.push({type:"text", value:"Set desired parameters\nthen select action button to update"});
panel.push({type:"text", value:"Status: Standing by"});
statusRow = panel.length-1;
panel.push({type:"slider", range:[0,10], value:5, width:300, label:"SOG knots"});
SOGrow = panel.length-1;
panel.push({type:"slider", range:[0,360], value:180, width:300, label:"COG °"});
COGrow = panel.length-1;
panel.push({type:"button", label:["Compass course"]})
panel.push({type:"hLine"});
panel.push({type:"slider", range:[0,360], value:180, width:300, label:"Wind °"});
windDirectionRow = panel.length-1;
//panel.push({type:"slider", range:[0,180], value:90, width:300, label:"Angle to wind °"});
panel.push({type:"spinner", range:[0,180], value:50, label:"Angle to wind °"});
windAngleRow = panel.length-1;
panel.push({type:"slider", range:[0,50], value:15, width:300, label:"Wind knots"});
windSpeedRow = panel.length-1;
panel.push({type:"button", label:["    Port tack     ", "Starboard tack"]})
panel.push({type:"hLine"});
panel.push({type:"button", label:["Quit"]})

var COG, SOG;
tick = 2;	// update every this number of seconds
isActive = stopping = false;
var positionLast = {latitude:0,longitude:0};
var positionNext;
onDialogue(panelAction, panel);
consoleHide();

function panelAction(panelRead){
	button = panelRead[panelRead.length-1].label;
	if (button == "Quit"){
		stopScript("Quit");
		}
	SOG = panel[SOGrow].value = panelRead[SOGrow].value;
	windDirection = panelRead[windDirectionRow].value;
	windAngle = panelRead[windAngleRow].value;
	windSpeed = panelRead[windSpeedRow].value;
	COG = panel[COGrow].value = panelRead[COGrow].value;
	nav = OCPNgetNavigation();
	positionLast.latitude = nav.position.latitude;
	positionLast.longitude = nav.position.longitude;
	stopping = false;
	if (button.search("Stop") >= 0){
		stopping = true;
		isActive = false;
		panel[panel.length-1].label = ["Quit"];		
		status = "Standing by";
		}
	else if (button.search("Compass") >= 0){
		status = "Steering compass course";
		}
	else if (button.search("Starboard") >= 0){
		COG = windDirection - windAngle;
		if (COG < 0) {COG += 360;}
		status = "On starboard tack";
		}
	else if (button.search("Port") >= 0){
		COG = windDirection + windAngle;
		if (COG >= 360) {COG -= 360;}
		status = "On port tack";
		}
	vector = {bearing: COG, distance: SOG*tick/(60*60)};
	if (!isActive && !stopping){	// just starting
//		print("COG:", COG, " SOG:", SOG, " tick:", tick," ",vector, "\n");
		panel[panel.length-1].label = ["Stop", "Quit"];
		onSeconds(update, tick);
		isActive = true;
		}
	// now to update the dialogue
	panel[COGrow].value = COG;
	panel[SOGrow].value = SOG;
	panel[windDirectionRow].value = windDirection;
	panel[windAngleRow].value = windAngle;
	panel[windSpeedRow].value = windSpeed;
	panel[statusRow].value = "Status: " + status;
	onDialogue(panelAction, panel);
	};

function update(){
	positionNext = new Position(OCPNgetPositionPV(positionLast, vector));
	if (!stopping) onSeconds(update, tick);
	thisMoment = new Date();
	moment = thisMoment.toTimeString();
	date = thisMoment.toDateString();
	UTC = moment.slice(0,2) + moment.slice(3,5) + moment.slice(6,12);
	date = date.slice(2,4) + date.slice(5,7) + date.slice(8, 10);
//	RMC = "$JSRMC," + UTC + ",A," + newPosition.NMEA + "," + SOG + "," + COG + "," + date + "+,,,,A"; 
	GLL = "$JSGLL," + positionNext.NMEA + "," + UTC + ",A,A"  ;
	OCPNpushNMEA(GLL);
	VTG = "$JSVTG," + COG + ",T,,M," + SOG + ",N,,K,A";
	OCPNpushNMEA(VTG);
	MWV = "$JSMWV," + windDirection + ",T," + windSpeed + ",N,A";
	OCPNpushNMEA(MWV);
	positionLast = positionNext;
	};