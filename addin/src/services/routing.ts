/**
 * OSRM road polyline fetching.
 * Ported from backend-alg smartroute.js fetchRoadPolyline().
 */

export type LatLng = [number, number]; // [lat, lng]

/**
 * Fetch a road-following polyline from OSRM for a sequence of waypoints.
 * Falls back to straight lines if OSRM is unreachable.
 */
export async function fetchRoadPolyline(
  points: { lat: number; lng: number }[],
): Promise<LatLng[]> {
  if (points.length < 2) {
    return points.map((p) => [p.lat, p.lng] as LatLng);
  }

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.code === "Ok" && data.routes?.[0]) {
      // GeoJSON coordinates are [lng, lat] — flip for Leaflet
      return data.routes[0].geometry.coordinates.map(
        (c: number[]) => [c[1], c[0]] as LatLng,
      );
    }
  } catch {
    // OSRM unavailable — fall back
  }

  return points.map((p) => [p.lat, p.lng] as LatLng);
}
