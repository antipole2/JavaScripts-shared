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