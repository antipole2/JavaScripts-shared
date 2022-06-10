const folder ="/Users/Tony/Documents/Marine/Tracks/";	// where files are
const trackFile = folder + "Tracks.kml";

nextStyleIndex = 0;
const lineStyles = "ABCDEFGH";
const log = false;
const abbreviate = false;	// abbreviate track points for testing
indent = 1;
const separation = 0.1;	// allowed separation in nm between track end point and next start point without warning
const mooringMatch = /(#buoy)|(#anchor)|(#bollard)/;
const places = 5;	// decimal places in positions

// enduring variables
var tracks = [];
var lastPoint;
var lastMooring;
var output;	// output buffer

guids = OCPNgetTrackGUIDs();
for (t = 0; t < guids.length; t++){
	track = OCPNgetTrack(guids[t]);
	if (track.name.match(/Layer/)) continue;
	if (track.name.match(/#A/) == null) tracks.push(track);
	}
if (tracks.length == 0) throw("No unarchived tracks");
print(tracks.length, " tracks to do\n");

tracks.sort(function(a, b){	// sort on start time
		astart = a.waypoints[0].creationDateTime;
		bstart = b.waypoints[0].creationDateTime;
		if (bstart < astart) return 1;
		if (bstart > astart) return -1;
		return 0;
		}
	);

output = "";

continuity = true;
for (t = 0; t < tracks.length; t++){	// for each not archived track
	track = tracks[t];
	// start
	point = track.waypoints[0];
	startMooring = track.from.match(mooringMatch);
	if (startMooring == null ) throw("Track '" + track.name + "' does not have valid mooring in 'from' (#buoy | #anchor | #bollard)");
	startMooring = startMooring[0];
	out(1, "<Placemark>" + "\n");
	out(++indent,"<name>" + track.from.replace(/ *#.*/, "") + "</name>" + "\n");
	startTime = point.creationDateTime;
	if (continuity && t > 0) {
		if (lastPoint.creationDateTime == startTime){
			printOrange("Warning: \n\tFirst point in track '", track.name, "' has same timestamp as last point in track ", tracks[i-1].name, "'\n");
			}
		timeString = formTimeStamp(lastPoint.creationDateTime) + " to " + formTimeStamp(startTime);
		}
	else timeString = formTimeStamp(startTime);
	out(0, "<description>" + timeString + "</description>" + "\n");
	out(0, "<styleUrl>" + startMooring + "</styleUrl>" + "\n");
	out(0, "<Point>" + "\n");
	out(++indent,"<coordinates>" + point.position.longitude.toFixed(places) + "," + point.position.latitude.toFixed(places) + "</coordinates>" + "\n");
	out(--indent,"</Point>" + "\n");
	out(--indent, "</Placemark>" + "\n");


	// track
	out(0, "<Placemark>" + "\n");
	out(++indent,"<visibility>0</visibility>" + "\n");
	out(+0, "<open>0</open>" + "\n");
	out(0, "<styleUrl>#" + lineStyles[nextStyleIndex] + "</styleUrl>" + "\n");
	nextStyleIndex = (nextStyleIndex+1)%8;	// for next time
	out(0, "<name>" + track.name + "</name>" + "\n");
	out(0, "<description>" + "</description>" + "\n");
	out(0, "<LineString>" + "\n");
	out(++indent,"<coordinates>" + "\n");
	points = "";
	lastPoint = track.waypoints[track.waypoints.length-1]; // remember last point
	if (!abbreviate){
		for (p = 0; p < track.waypoints.length; p++){
			points += track.waypoints[p].position.longitude.toFixed(places) + "," + track.waypoints[p].position.latitude.toFixed(places) + " ";
			}
		}
	else points = track.waypoints[0].position.longitude.toFixed(places) + "," + track.waypoints[0].position.latitude.toFixed(places) + "\n" +
			lastPoint.position.longitude.toFixed(places) + "," + lastPoint.position.latitude.toFixed(places) + "\n";
	out(-1, points);
	out(0, "</coordinates>" + "\n");
	out(--indent, "</LineString>" + "\n");
	out(--indent, "</Placemark>" + "\n");
	if (t > 0 && t < tracks.length - 1){	// middle point
		continuity = true;
		nextPoint = tracks[t+1].waypoints[0];	// start of next track
		vector = OCPNgetVectorPP(lastPoint.position, nextPoint.position);
		if (vector.distance > separation) {
			printOrange("Warning: \n\tTrack '", tracks[t+1].name, "' starts ", vector.distance.toFixed(2), "nm\n\tfrom end of track '", track.name, "'\n");
			continuity = false;
			}
		lastMooring = tracks[t].to.match(mooringMatch);
		if (lastMooring == null ) throw("Track '" + tracks[t].name + "' does not have valid mooring in 'to' (#buoy | #anchor | #bollard)");
		lastMooring = lastMooring[0];
		nextMooring = tracks[t+1].from.match(mooringMatch);
		if (nextMooring == null ) throw("Track '" + tracks[t+1].name + "' does not have valid mooring in 'from' (#buoy | #anchor | #bollard)");
		nextMooring = nextMooring[0];
		if (nextMooring != lastMooring){
			printOrange("Warning: \n\tTrack '", tracks[t+1].name, "' start mooring ", nextMooring, "\n\tdiffers from end mooring of previous track '", track.name, " ", lastMooring, "\n");
			continuity = false;
			}
		}


	// end
	lastMooring = track.to.match(mooringMatch);
	if (lastMooring == null ) throw("Track '" + track.name + "' does not have valid mooring in 'to' (#buoy | #anchor | #bollard)");
	lastMooring = lastMooring[0];
	if (!continuity || t == tracks.length-1){
		point = track.waypoints[track.waypoints.length-1];
		out(1, "<Placemark>" + "\n");
		out(++indent,"<name>" + track.to.replace(/ *#.*/, "") + "</name>" + "\n"); 
		out(0, "<description>" + formTimeStamp(point.creationDateTime) + "</description>" + "\n");
		out(0, "<styleUrl>" + lastMooring + "</styleUrl>" + "\n");
		out(0, "<Point>" + "\n");
		out(++indent,"<coordinates>" + lastPoint.position.longitude.toFixed(places) + "," + lastPoint.position.latitude.toFixed(places) + "</coordinates>" + "\n");
		out(--indent,"</Point>" + "\n");
		out(--indent, "</Placemark>" + "\n");
		}
	}


// write to disk adding top and tail
headTail = readTextFile(folder + "Head.kml");
writeTextFile(headTail, trackFile, 1);
writeTextFile(output, trackFile, 2);
headTail = readTextFile(folder + "Tail.kml");
writeTextFile(headTail, trackFile, 2);
scriptResult(".kml file written");

function out(level, text)	{// do output indented by level
	const tab = "     ";
	line = "";
	if (level >= 0)
		for (var t = 0; t < indent; t++) line += tab;
	line += text;
	if (log) print(line);
	output += line;
	}
 
function formTimeStamp(time){	// format a timestamp as we want it for this waypoint
	moment = new Date(time*1000);
	string = moment.toString();
	result = string.replace(/\.\d\d\d/, "");
	return result;
	}
