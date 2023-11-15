// Listen out for SignalK messages and display

Position = require("Position");
OCPNonMessageName(received, "OCPN_CORE_SIGNALK");

function received(message){
	signalK = JSON.parse(message);
//	print(JSON.stringify(signalK, null, "\t"), "\n\n"); // uncomment to pretty-print object
	for (u = 0; u < signalK.updates.length; u++){
	update = signalK.updates[u];
	timeStamp = update.timestamp;
	sentence = update.source.sentence;
	values = update.values;
	for (v = 0; v < values.length; v++){
		what = values[v].path;
		value = values[v].value;
		}
	switch (sentence){
		case "GLL":
			position = new Position(value);
			print("Position at\t\t", timeStamp, " is\t", position.formatted, "\n");
			break
		case "VTG":
			cog = values[1].value;
			sog = values[2].value;
			print("Over ground at\t\t", timeStamp, " is\tCOG:", cog, "\tSOG:", sog,  "\n");
			break;
		case "VHW":
			hdt = values[0].value;
			stw = values[1].value;
			print("Through water at\t", timeStamp, " is\tHDT:", hdt, "\tSTW:", stw,  "\n");
		default:
		}
		}
	OCPNonMessageName(received, "OCPN_CORE_SIGNALK");
	};
