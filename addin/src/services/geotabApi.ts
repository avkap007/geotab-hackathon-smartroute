/**
 * Promise-based wrapper for Geotab API calls.
 * Ported from backend-alg smartroute.js data-loading and route-writeback logic.
 *
 * Falls back to FALLBACK_ROUTES when running outside Geotab (dev mode).
 */

import { getGeotabApi, type GeotabApi } from "../main";
import type { AlgoBin } from "./algorithm";

/* ── Types ── */

export interface RouteEntry {
  id: string;
  name: string;
  bins: AlgoBin[];
  depot: { lat: number; lng: number };
  collectionLogs: unknown[];
}

export interface GeotabRouteRef {
  id: string;
  name: string;
  comment?: string;
  bins?: AlgoBin[];        // only present on fallback demo routes
  depot?: { lat: number; lng: number };
  collectionLogs?: unknown[];
}

/* ── Constants ── */

const MY_ADDIN_ID = "SmartRouteBinState2026";

/* ── Fallback demo data ── */

const FALLBACK_ROUTES: GeotabRouteRef[] = [
  {
    id: "demo-route-1",
    name: "Downtown West",
    bins: [
      { id: "dw-1", name: "King & Spadina",     lat: 43.6449, lng: -79.3966, fillLevel: 85 },
      { id: "dw-2", name: "Queen & Bathurst",    lat: 43.6439, lng: -79.4082, fillLevel: 42 },
      { id: "dw-3", name: "Dundas & University", lat: 43.6555, lng: -79.3895, fillLevel: 72 },
      { id: "dw-4", name: "College & Spadina",   lat: 43.6595, lng: -79.4016, fillLevel: 28 },
      { id: "dw-5", name: "Bloor & Ossington",   lat: 43.6627, lng: -79.4258, fillLevel: 91 },
      { id: "dw-6", name: "Bloor & Bathurst",    lat: 43.6664, lng: -79.4119, fillLevel: 15 },
      { id: "dw-7", name: "Harbord & Spadina",   lat: 43.6611, lng: -79.4013, fillLevel: 63 },
    ],
    depot: { lat: 43.6400, lng: -79.4100 },
    collectionLogs: [],
  },
  {
    id: "demo-route-2",
    name: "Midtown East",
    bins: [
      { id: "me-1", name: "Yonge & Eglinton",        lat: 43.7065, lng: -79.3985, fillLevel: 78 },
      { id: "me-2", name: "Yonge & Lawrence",         lat: 43.7249, lng: -79.4027, fillLevel: 55 },
      { id: "me-3", name: "Mt Pleasant & Davisville", lat: 43.7002, lng: -79.3900, fillLevel: 91 },
      { id: "me-4", name: "Bayview & Moore",          lat: 43.7043, lng: -79.3722, fillLevel: 33 },
      { id: "me-5", name: "Chaplin & Eglinton",       lat: 43.7072, lng: -79.4140, fillLevel: 67 },
    ],
    depot: { lat: 43.7100, lng: -79.4000 },
    collectionLogs: [],
  },
  {
    id: "demo-route-3",
    name: "Waterfront Loop",
    bins: [
      { id: "wf-1", name: "Queens Quay & York",    lat: 43.6390, lng: -79.3762, fillLevel: 94 },
      { id: "wf-2", name: "Queens Quay & Spadina",  lat: 43.6383, lng: -79.3953, fillLevel: 48 },
      { id: "wf-3", name: "Harbourfront Centre",    lat: 43.6387, lng: -79.3812, fillLevel: 82 },
      { id: "wf-4", name: "Rees St & Queens Quay",  lat: 43.6385, lng: -79.3838, fillLevel: 19 },
      { id: "wf-5", name: "Simcoe & Bremner",       lat: 43.6413, lng: -79.3868, fillLevel: 71 },
    ],
    depot: { lat: 43.6420, lng: -79.3800 },
    collectionLogs: [],
  },
];

/* ── Helpers ── */

function callApi<T>(api: GeotabApi, method: string, params: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    api.call(method, params, (result) => resolve(result as T), (err) => reject(err));
  });
}

interface GeotabZone {
  id: string;
  name?: string;
  points?: { x: number; y: number }[];
}

function zoneCentroid(zone: GeotabZone): { lat: number; lng: number } | null {
  const pts = zone.points || [];
  if (pts.length === 0) return null;
  let lat = 0, lng = 0;
  for (const p of pts) { lng += p.x || 0; lat += p.y || 0; }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

function createZonePoints(lat: number, lng: number) {
  const o = 0.0001;
  return [
    { x: lng - o, y: lat - o }, { x: lng + o, y: lat - o },
    { x: lng + o, y: lat + o }, { x: lng - o, y: lat + o },
    { x: lng - o, y: lat - o },
  ];
}

/* ── Public API ── */

/**
 * Fetch all route references for the search dropdown.
 * Returns Geotab routes when connected, fallback demo routes otherwise.
 */
export async function fetchAllRoutes(): Promise<GeotabRouteRef[]> {
  const api = getGeotabApi();
  if (!api) return FALLBACK_ROUTES;
  try {
    const routes = await callApi<GeotabRouteRef[]>(api, "Get", { typeName: "Route" });
    return routes.length > 0 ? routes : FALLBACK_ROUTES;
  } catch {
    return FALLBACK_ROUTES;
  }
}

/**
 * Load a single route's bins from Geotab (zones + RoutePlanItems + AddInData fill levels).
 * For fallback routes that already have bins, returns them directly.
 */
export async function loadRouteById(routeId: string, routeName: string, existingBins?: AlgoBin[], existingDepot?: { lat: number; lng: number }): Promise<RouteEntry | null> {
  // Demo routes already have bins baked in
  if (existingBins && existingDepot) {
    return { id: routeId, name: routeName, bins: existingBins, depot: existingDepot, collectionLogs: [] };
  }

  const api = getGeotabApi();
  if (!api) return null;

  try {
    // Step 1: Fetch all zones and build lookup
    const zones = await callApi<GeotabZone[]>(api, "Get", { typeName: "Zone" });
    const zoneMap: Record<string, { id: string; name: string; lat: number; lng: number }> = {};
    for (const z of zones || []) {
      const c = zoneCentroid(z);
      if (c) {
        zoneMap[z.id] = { id: z.id, name: z.name || `Zone ${z.id}`, lat: c.lat, lng: c.lng };
      }
    }

    // Step 2: Fetch RoutePlanItems for this route
    const items = await callApi<{ zone?: { id: string } | string; sequence?: number }[]>(
      api, "Get", { typeName: "RoutePlanItem", search: { route: { id: routeId } } },
    );
    const sorted = (items || []).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    const bins: AlgoBin[] = [];
    const addedIds = new Set<string>();
    for (const item of sorted) {
      const zid = typeof item.zone === "object" && item.zone ? item.zone.id : String(item.zone);
      const zData = zoneMap[zid];
      if (zData && !addedIds.has(zData.id)) {
        addedIds.add(zData.id);
        bins.push({ id: zData.id, name: zData.name, lat: zData.lat, lng: zData.lng, fillLevel: 50 });
      }
    }

    // Step 3: Merge persisted fill levels from AddInData
    let collectionLogs: unknown[] = [];
    try {
      const addinData = await callApi<{ id: string; details: { type: string; bins?: { id: string; fillLevel: number }[]; [k: string]: unknown } }[]>(
        api, "Get", { typeName: "AddInData", search: { addInId: MY_ADDIN_ID } },
      );
      const fillById: Record<string, number> = {};
      for (const r of addinData || []) {
        if (r.details?.type === "bin_state" && r.details.bins) {
          for (const b of r.details.bins) {
            fillById[b.id] = b.fillLevel;
          }
        }
        if (r.details?.type === "collection_log") {
          collectionLogs.push(r.details);
        }
      }
      for (const bin of bins) {
        bin.fillLevel = fillById[bin.id] ?? Math.floor(Math.random() * 90) + 10;
      }
    } catch {
      for (const bin of bins) {
        if (!bin.fillLevel) bin.fillLevel = Math.floor(Math.random() * 90) + 10;
      }
    }

    const depot = bins.length > 0
      ? { lat: bins[0].lat, lng: bins[0].lng }
      : { lat: 43.65, lng: -79.38 };

    return { id: routeId, name: routeName, bins, depot, collectionLogs };
  } catch {
    return null;
  }
}

/**
 * Write an optimized route back to Geotab as a new Route entity.
 */
export async function writeRouteToGeotab(
  baseName: string,
  optimizedBins: AlgoBin[],
): Promise<string | null> {
  const api = getGeotabApi();
  if (!api) {
    console.log("[SmartRoute] Demo mode: accepted route (no Geotab write)");
    return "demo-accepted";
  }

  if (optimizedBins.length < 2) return null;

  const routeName = `SmartRoute-${baseName}-${new Date().toISOString().slice(0, 10)}`;

  // Step 1: Create zones for bins that don't have real Geotab IDs
  const zoneRefs: { id: string }[] = [];
  for (const bin of optimizedBins) {
    const isDemo = bin.id.startsWith("demo-") || bin.id.startsWith("dw-") ||
                   bin.id.startsWith("me-") || bin.id.startsWith("wf-");
    if (!isDemo) {
      zoneRefs.push({ id: bin.id });
    } else {
      const zoneId = await callApi<string>(api, "Add", {
        typeName: "Zone",
        entity: {
          name: `SR-${bin.name || bin.id}`,
          points: createZonePoints(bin.lat, bin.lng),
          displayed: true,
          groups: [{ id: "GroupCompanyId" }],
        },
      });
      zoneRefs.push({ id: zoneId });
    }
  }

  // Step 2: Create Route
  const newRouteId = await callApi<string>(api, "Add", {
    typeName: "Route",
    entity: { name: routeName, comment: "SmartRoute optimized waste collection" },
  });

  // Step 3: Create RoutePlanItems
  for (let seq = 0; seq < zoneRefs.length; seq++) {
    try {
      await callApi<string>(api, "Add", {
        typeName: "RoutePlanItem",
        entity: { route: { id: newRouteId }, zone: zoneRefs[seq], sequence: seq },
      });
    } catch (err) {
      console.warn("[SmartRoute] RoutePlanItem error:", err);
    }
  }

  return routeName;
}

/**
 * Fetch live vehicle positions from Geotab.
 */
export async function fetchVehicleStatuses(): Promise<{ latitude: number; longitude: number }[]> {
  const api = getGeotabApi();
  if (!api) return [];
  try {
    const statuses = await callApi<{ latitude?: number; longitude?: number }[]>(
      api, "Get", { typeName: "DeviceStatusInfo" },
    );
    return (statuses || []).filter(
      (s): s is { latitude: number; longitude: number } => !!s.latitude && !!s.longitude,
    );
  } catch {
    return [];
  }
}
