// listens for OpenCPN sentences and NMEA messages over configured time and reports
// sorts NMEA messages by type and then sender

var timeSeconds = 30; // time period over which to count
var showSentences = true;	// display latest sentence of each type at end
var displayThese = ["TKABC", "SNABC"];	// list all of these sentences


var progressSeconds = 5;  // count down this often
var secondsLeft = timeSeconds;
const log = [];   // will be array of entries
const buffer = [];	// will hold displayThese data

onSeconds(progress, 1); // count down every progressSeconds secs, but first almost immediately
onSeconds(report, timeSeconds);
OCPNonNMEAsentence(logit);

function progress(){
	if (secondsLeft == timeSeconds){
		// this is first time in
		print("Collecting data\nSeconds remaining");
		}
	if (secondsLeft >= progressSeconds){
		print(" ", secondsLeft);
		if (secondsLeft > progressSeconds) onSeconds(progress, progressSeconds);
		secondsLeft -= progressSeconds;
		}
	}

function logit(returned){
	var entry = {type: "", count: 0};
	if (secondsLeft > 0) OCPNonNMEAsentence(logit);
	if (returned.OK){
		thisType = returned.value.slice(1, 6);
		for (i in displayThese){	// thses types to be displayed live
			if (thisType == displayThese[i]) buffer.push(returned.value);
			}
		count = log.length
		if (count > 0){
			for (i in log){
				if (log[i].type == thisType){
					log[i].count += 1;
					log[i].sentence = returned.value;
					return;
					}
				}
			}
		// no match or first entry - create new one
		entry.type = thisType;
		entry.count = 1;
		entry.sentence = returned.value;
		entry.sortField = returned.value.slice(3,6) + returned.value.slice(1,3);
		log.push(entry);
		}
	}
	

function report(){
	secondsLeft = 0;
	print("\n\nOCPN messages seen:\n", OCPNgetMessageNames());
	entryCount = log.length;
	if (entryCount > 0){
		log.sort(function(a,b){	// sort on sortField
			if (a.sortField == b.sortField) return 0;
			else if (a.sortField < b.sortField) return -1;
			else return 1;
			});
		print("\nNMEA sentences seen and their counts:\n");
		for (i in log){
			print(log[i].type, " ", log[i].count,"\n");
			}
		if (showSentences){
			print("\nSample of each NMEA sentence type\n");
			for (i in log) print(log[i].sentence,"\n");
			print("\n");
			}
		if (buffer.length > 0){
			print("\nFull log of selected sentences\n");
			for(i in buffer) print(buffer[i], "\n");
			}
		}
	else print("\nNo NMEA to report\n");
	// now to cancel any outstanding request for NMEA sentences
	// for backards compatibility with plugin versions before v0.3 we use
	try {OCPNcancelAll();}	// pre v0.3
	catch(err){	// v0.3 onwards
		OCPNonNMEAsentence();
		onSeconds();
		}
	}
