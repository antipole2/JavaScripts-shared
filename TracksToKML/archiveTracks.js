// mark all routes as archived by appending a tag to the route name


guids = OCPNgetTrackGUIDs();
tagged = 0;
for (t = 0; t < guids.length; t++){
	track = OCPNgetTrack(guids[t]);
	if (track.name.match(/Layer/)) continue;// ignore tracks in layers
	archived = track.name.match(/#A/);
	if (archived == null){	// this one not yet tagged
		track.name += " #A";
		OCPNupdateTrack(track);
		tagged++;
		}
	}
scriptResult(tagged + " tracks newly tagged as archived");